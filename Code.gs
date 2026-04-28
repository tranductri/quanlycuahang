var SPREADSHEET_ID = '1EfEAvuYPyf3GWVbi7egfR6SI3riNKPsCiVW0OFZLpg8';
var DENOMS = [500000,200000,100000,50000,20000,10000,5000,2000,1000];

// ── Sheet name per location ───────────────────────────────────
function getSheetName(vi_tri) {
  if (vi_tri === 'Bình Tân') return 'binh_tan';
  if (vi_tri === 'Quận 6')   return 'quan_6';
  return 'ca_lam_viec';
}

// ── Products for a location (reads san_pham sheet, filters by column) ──
// Returns [{ten, gia, sourceIdx}] where sourceIdx = 0-based index in all products
function getProductsForLocation(vi_tri) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('san_pham');
    if (!sheet || sheet.getLastRow() < 2) return fallbackProducts(vi_tri);
    var rows  = sheet.getDataRange().getValues();
    // header: ten_sp(0), gia(1), binh_tan(2), quan_6(3)
    var col   = vi_tri === 'Bình Tân' ? 2 : 3;
    var result = [], idx = 0;
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      if (rows[i][col] === 'x') {
        result.push({ten: String(rows[i][0]), gia: Number(rows[i][1])||0, sourceIdx: idx});
      }
      idx++;
    }
    return result.length ? result : fallbackProducts(vi_tri);
  } catch(e) { return fallbackProducts(vi_tri); }
}

function fallbackProducts(vi_tri) {
  var all = [
    {ten:'Bánh bao xúc xích phomai',          gia:20000, bt:true,  q6:true},
    {ten:'Bánh bao xá xíu phomai',            gia:22000, bt:true,  q6:true},
    {ten:'Bánh bao gà nấm phomai',            gia:28000, bt:true,  q6:true},
    {ten:'Bánh bao bò phomai',                gia:25000, bt:true,  q6:true},
    {ten:'Bánh bao thịt trứng cút',           gia:20000, bt:true,  q6:true},
    {ten:'Bánh bao hình thú',                 gia:15000, bt:true,  q6:true},
    {ten:'Bánh bao kimsa',                    gia:15000, bt:true,  q6:true},
    {ten:'Bánh bao lava matcha',              gia:15000, bt:true,  q6:true},
    {ten:'Bánh bao gạo lứt không nhân',       gia:10000, bt:true,  q6:false},
    {ten:'Bánh bao chay ngũ sắc',             gia:15000, bt:true,  q6:false},
    {ten:'Bánh mì pate chà bông',             gia:15000, bt:true,  q6:false},
    {ten:'Bánh mì xúc xích chà bông',        gia:18000, bt:true,  q6:false},
    {ten:'Bánh mì gà cay chua ngọt',         gia:20000, bt:true,  q6:false},
    {ten:'Bánh mì bò',                        gia:22000, bt:true,  q6:false},
    {ten:'Mì ý bò bằm',                       gia:28000, bt:true,  q6:false},
    {ten:'Mì ý sốt kem nấm thịt xông khói',  gia:28000, bt:true,  q6:false},
    {ten:'Mì ý sốt thanh cua',               gia:28000, bt:true,  q6:false},
    {ten:'Cơm nắm teriyaki',                  gia:15000, bt:true,  q6:true},
    {ten:'Cơm nắm xúc xích phomai tan chảy', gia:17000, bt:true,  q6:true},
    {ten:'Yaourt',                             gia:10000, bt:true,  q6:true},
  ];
  var isBT = vi_tri === 'Bình Tân';
  return all.filter(function(p,i){ return isBT ? p.bt : p.q6; })
            .map(function(p, localIdx){ return {ten:p.ten, gia:p.gia, sourceIdx:localIdx}; });
}

// ── doGet ────────────────────────────────────────────────────
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var result;
  if (params.action === 'lastShift' && params.vi_tri) {
    result = getLastShift(params.vi_tri);
  } else {
    result = {success:true};
  }
  var json = JSON.stringify(result);
  if (params.callback) {
    return ContentService
      .createTextOutput(params.callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Get last submitted shift for a location ──────────────────
function getLastShift(vi_tri) {
  try {
    var sheetName    = getSheetName(vi_tri);
    var locationProds = getProductsForLocation(vi_tri);
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return {success:false};
    var rows  = sheet.getDataRange().getValues();
    var last  = rows[rows.length - 1];
    var products = locationProds.map(function(prod, i) {
      var cuoi = last[4 + i * 13 + 8];
      return {cuoi_thuc: (cuoi === '' || cuoi === null || cuoi === undefined) ? undefined : Number(cuoi)};
    });
    return {success:true, ngay:last[1], ten:last[3], products:products};
  } catch(err) {
    return {success:false, error:err.toString()};
  }
}

// ── doPost: receive shift report ─────────────────────────────
function doPost(e) {
  try {
    var raw  = (e && e.postData) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    var vi_tri        = data.vi_tri || '';
    var sheetName     = getSheetName(vi_tri);
    var locationProds = getProductsForLocation(vi_tri);
    var ss            = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet         = ss.getSheetByName(sheetName);

    // Backup if schema changed
    if (sheet && sheet.getLastColumn() !== buildHeaders(locationProds).length) {
      var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
      sheet.setName(sheetName + '_backup_' + stamp);
      sheet = null;
    }

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = buildHeaders(locationProds);
      var hRange  = sheet.getRange(1, 1, 1, headers.length);
      hRange.setValues([headers]);
      hRange.setBackground('#c1502e');
      hRange.setFontColor('#ffffff');
      hRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow(buildRow(data, locationProds));

    return ContentService
      .createTextOutput(JSON.stringify({success:true, message:'Đã lưu ca thành công!'}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({success:false, error:err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Build header row ─────────────────────────────────────────
function buildHeaders(locationProds) {
  var h = ['Timestamp','Ngày','Vị trí','Tên'];

  locationProds.forEach(function(p) {
    var n = '['+p.ten+'] ';
    h.push(n+'Đầu H1', n+'Đầu H2', n+'Đầu Kho', n+'Hộp',
           n+'Xuất', n+'Nhập', n+'Hư', n+'KM',
           n+'Cuối TT', n+'Dự kiến', n+'Lệch',
           n+'Tiêu thụ (cái)', n+'Doanh thu');
  });

  DENOMS.forEach(function(d) { h.push('ĐC '+denomLabel(d)+' (tờ)'); });
  DENOMS.forEach(function(d) { h.push('CC '+denomLabel(d)+' (tờ)'); });
  DENOMS.forEach(function(d) { h.push('CấtDT '+denomLabel(d)+' (tờ)'); });

  h.push(
    'Tổng tiền ĐC', 'Tổng tiền CC',
    'Chi phí', 'DT chuyển khoản',
    'Tổng DT hàng', 'Lệch tiền',
    'Tổng cất DT', 'Còn lại ca sau',
    'Người giao', 'Người nhận', 'Ghi chú'
  );
  return h;
}

// ── Build data row from POST payload ────────────────────────
function buildRow(data, locationProds) {
  var tz  = Session.getScriptTimeZone();
  var ts  = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');
  var row = [ts, data.ngay||'', data.vi_tri||'', data.ten||''];

  var totalRev = 0;
  var dataProds = data.products || [];

  locationProds.forEach(function(p) {
    var v         = dataProds[p.sourceIdx] || {};
    var dau_h1    = Number(v.dau_h1)  || 0;
    var dau_h2    = Number(v.dau_h2)  || 0;
    var dau_kho   = Number(v.dau_kho) || 0;
    var dau_cu    = Number(v.dau_cu)  || 0;
    var xuat      = Number(v.xuat)    || 0;
    var nhap      = Number(v.nhap)    || 0;
    var hu        = Number(v.hu)      || 0;
    var km        = Number(v.km)      || 0;
    var cuoi_thuc = (v.cuoi_thuc !== undefined && v.cuoi_thuc !== '') ? Number(v.cuoi_thuc) : '';
    var predicted = dau_h1 + dau_h2 + dau_kho + dau_cu + nhap - xuat - hu - km;
    var lech      = cuoi_thuc !== '' ? cuoi_thuc - predicted : '';
    var tieu_thu  = cuoi_thuc !== '' ? Math.max(0, dau_h1 + dau_h2 + dau_kho + dau_cu + nhap - hu - km - cuoi_thuc) : xuat;
    var dt        = tieu_thu * p.gia;
    totalRev += dt;

    row.push(dau_h1, dau_h2, dau_kho, dau_cu, xuat, nhap, hu, km, cuoi_thuc, predicted, lech, tieu_thu, dt);
  });

  var tienDau  = data.tien_dau  || {};
  var tienCuoi = data.tien_cuoi || {};
  var tongDau  = 0, tongCuoi = 0;

  DENOMS.forEach(function(d) { var n=Number(tienDau[d])||0;  row.push(n); tongDau  += n*d; });
  DENOMS.forEach(function(d) { var n=Number(tienCuoi[d])||0; row.push(n); tongCuoi += n*d; });

  var catDtData = data.cat_dt || {};
  var tongCat   = 0;
  DENOMS.forEach(function(d) { var n=Number(catDtData[d])||0; row.push(n); tongCat += n*d; });

  var chiPhi  = Number(data.chi_phi) || 0;
  var dtNH    = Number(data.dt_nh)   || 0;
  var expected= tongDau + (totalRev - dtNH) - chiPhi;
  var lechTien= tongCuoi - expected;
  var conLai  = tongCuoi - tongCat;

  row.push(
    tongDau, tongCuoi,
    chiPhi, dtNH,
    totalRev, lechTien,
    tongCat, conLai,
    data.nguoi_giao||'', data.nguoi_nhan||'', data.ghi_chu||''
  );

  return row;
}

function denomLabel(d) {
  return d >= 1000000 ? (d/1000000)+'tr' : d >= 1000 ? (d/1000)+'k' : String(d);
}

var SPREADSHEET_ID = '1EfEAvuYPyf3GWVbi7egfR6SI3riNKPsCiVW0OFZLpg8';
var DENOMS = [500000,200000,100000,50000,20000,10000,5000,2000,1000];

// ── Open spreadsheet once per execution ──────────────────────
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ── CacheService key for product list ────────────────────────
var PRODUCT_CACHE_KEY = 'san_pham_rows';
var PRODUCT_CACHE_TTL = 21600; // 6 hours

// ── Read san_pham rows (cached) ───────────────────────────────
function getSanPhamRows(ss) {
  var cache = CacheService.getScriptCache();
  var hit   = cache.get(PRODUCT_CACHE_KEY);
  if (hit) return JSON.parse(hit);

  var sheet = ss.getSheetByName('san_pham');
  if (!sheet || sheet.getLastRow() < 2) return null;
  var rows = sheet.getDataRange().getValues().slice(1); // skip header
  cache.put(PRODUCT_CACHE_KEY, JSON.stringify(rows), PRODUCT_CACHE_TTL);
  return rows;
}

// ── Debug logger ─────────────────────────────────────────────
function writeLog(ss, action, status, meta, rawPayload) {
  try {
    var sheet = ss.getSheetByName('debug_log');
    if (!sheet) {
      sheet = ss.insertSheet('debug_log');
      var h = ['Timestamp','Action','Status','Vị trí','Ngày','Tên','Tổng DT','Chi phí','DT NH','Lệch tiền','Ghi chú','Error','Raw payload'];
      var hRange = sheet.getRange(1, 1, 1, h.length);
      hRange.setValues([h]);
      hRange.setBackground('#1a1a2e');
      hRange.setFontColor('#ffffff');
      hRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(13, 400);
    }
    var tz = Session.getScriptTimeZone();
    var ts = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');
    var m  = meta || {};
    sheet.appendRow([
      ts, action, status,
      m.vi_tri   || '',
      m.ngay     || '',
      m.ten      || '',
      m.totalRev !== undefined ? m.totalRev : '',
      m.chiPhi   !== undefined ? m.chiPhi   : '',
      m.dtNH     !== undefined ? m.dtNH     : '',
      m.lechTien !== undefined ? m.lechTien : '',
      m.ghi_chu  || '',
      m.error    || '',
      rawPayload ? rawPayload.substring(0, 5000) : '',
    ]);
  } catch(e) {}
}

// ── Sheet name per location ───────────────────────────────────
function getSheetName(vi_tri) {
  if (vi_tri === 'Bình Tân') return 'binh_tan';
  if (vi_tri === 'Quận 6')   return 'quan_6';
  return 'ca_lam_viec';
}

// ── Products for a location ───────────────────────────────────
function getProductsForLocation(ss, vi_tri) {
  var rows = getSanPhamRows(ss);
  if (!rows) return fallbackProducts(vi_tri);
  var col    = vi_tri === 'Bình Tân' ? 2 : 3;
  var result = [];
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    if (rows[i][col] === 'x') {
      result.push({ten: String(rows[i][0]), gia: Number(rows[i][1])||0, sourceIdx: i});
    }
  }
  return result.length ? result : fallbackProducts(vi_tri);
}

function fallbackProducts(vi_tri) {
  return fallbackAllProducts()
    .filter(function(p){ return vi_tri === 'Bình Tân' ? p.binh_tan : p.quan_6; })
    .map(function(p, i){ return {ten:p.ten, gia:p.gia, sourceIdx:i}; });
}

// ── All products with location flags ─────────────────────────
function getAllProducts(ss) {
  var rows = getSanPhamRows(ss);
  if (!rows) return {success:true, products:fallbackAllProducts()};
  var products = [];
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    products.push({
      ten:      String(rows[i][0]),
      gia:      Number(rows[i][1]) || 0,
      binh_tan: rows[i][2] === 'x',
      quan_6:   rows[i][3] === 'x',
    });
  }
  return {success:true, products: products.length ? products : fallbackAllProducts()};
}

function fallbackAllProducts() {
  return [
    {ten:'Bánh bao xúc xích phomai',          gia:20000, binh_tan:true,  quan_6:true},
    {ten:'Bánh bao xá xíu phomai',            gia:22000, binh_tan:true,  quan_6:true},
    {ten:'Bánh bao gà nấm phomai',            gia:28000, binh_tan:true,  quan_6:true},
    {ten:'Bánh bao bò phomai',                gia:25000, binh_tan:true,  quan_6:true},
    {ten:'Bánh bao thịt trứng cút',           gia:20000, binh_tan:true,  quan_6:true},
    {ten:'Bánh bao hình thú',                 gia:15000, binh_tan:true,  quan_6:true},
    {ten:'Bánh bao kimsa',                    gia:15000, binh_tan:true,  quan_6:true},
    {ten:'Bánh bao lava matcha',              gia:15000, binh_tan:true,  quan_6:true},
    {ten:'Bánh bao gạo lứt không nhân',       gia:10000, binh_tan:true,  quan_6:false},
    {ten:'Bánh bao chay ngũ sắc',             gia:15000, binh_tan:true,  quan_6:false},
    {ten:'Bánh mì pate chà bông',             gia:15000, binh_tan:true,  quan_6:false},
    {ten:'Bánh mì xúc xích chà bông',        gia:18000, binh_tan:true,  quan_6:false},
    {ten:'Bánh mì gà cay chua ngọt',         gia:20000, binh_tan:true,  quan_6:false},
    {ten:'Bánh mì bò',                        gia:22000, binh_tan:true,  quan_6:false},
    {ten:'Mì ý bò bằm',                       gia:28000, binh_tan:true,  quan_6:false},
    {ten:'Mì ý sốt kem nấm thịt xông khói',  gia:28000, binh_tan:true,  quan_6:false},
    {ten:'Mì ý sốt thanh cua',               gia:28000, binh_tan:true,  quan_6:false},
    {ten:'Cơm nắm teriyaki',                  gia:15000, binh_tan:true,  quan_6:true},
    {ten:'Cơm nắm xúc xích phomai tan chảy', gia:17000, binh_tan:true,  quan_6:true},
    {ten:'Yaourt',                             gia:10000, binh_tan:true,  quan_6:true},
  ];
}

// ── doGet ────────────────────────────────────────────────────
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var ss     = getSpreadsheet();
  var result;
  if (params.action === 'lastShift' && params.vi_tri) {
    result = getLastShift(ss, params.vi_tri);
    writeLog(ss, 'doGet:lastShift', result.success ? 'ok' : 'error', {vi_tri: params.vi_tri, error: result.error});
  } else if (params.action === 'getProducts') {
    result = getAllProducts(ss);
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
function getLastShift(ss, vi_tri) {
  try {
    var locationProds = getProductsForLocation(ss, vi_tri);
    var sheet = ss.getSheetByName(getSheetName(vi_tri));
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
  var raw = (e && e.postData) ? e.postData.contents : '{}';
  var ss  = getSpreadsheet();
  try {
    var data = JSON.parse(raw);

    var vi_tri        = data.vi_tri || '';
    var sheetName     = getSheetName(vi_tri);
    var locationProds = getProductsForLocation(ss, vi_tri);
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

    var row = buildRow(data, locationProds);
    sheet.appendRow(row);

    var chiPhiV  = Number(data.chi_phi) || 0;
    var dtNHV    = Number(data.dt_nh)   || 0;
    var totalRev = 0;
    locationProds.forEach(function(p, i){ totalRev += Number(row[4 + i * 13 + 12]) || 0; });
    var tongDau = 0, tongCuoi = 0;
    DENOMS.forEach(function(d){ tongDau  += (Number((data.tien_dau  ||{})[d])||0)*d; });
    DENOMS.forEach(function(d){ tongCuoi += (Number((data.tien_cuoi ||{})[d])||0)*d; });
    var lechTien = tongCuoi - (tongDau + (totalRev - dtNHV) - chiPhiV);

    writeLog(ss, 'doPost', 'ok', {
      vi_tri: vi_tri, ngay: data.ngay||'', ten: data.ten||'',
      totalRev: totalRev, chiPhi: chiPhiV, dtNH: dtNHV,
      lechTien: lechTien, ghi_chu: data.ghi_chu||'',
    }, raw);

    return ContentService
      .createTextOutput(JSON.stringify({success:true, message:'Đã lưu ca thành công!'}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    writeLog(ss, 'doPost', 'ERROR', {error: err.toString()}, raw);
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

  var totalRev  = 0;
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

  var chiPhi   = Number(data.chi_phi) || 0;
  var dtNH     = Number(data.dt_nh)   || 0;
  var expected = tongDau + (totalRev - dtNH) - chiPhi;
  var lechTien = tongCuoi - expected;
  var conLai   = tongCuoi - tongCat;

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

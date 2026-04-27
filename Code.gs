var SHEET_CA = 'ca_lam_viec';
var SPREADSHEET_ID = '1EfEAvuYPyf3GWVbi7egfR6SI3riNKPsCiVW0OFZLpg8';

var PRODUCTS = [
  {ten:'Bánh bao xúc xích phomai',       gia:20000},
  {ten:'Bánh bao xá xíu phomai',         gia:22000},
  {ten:'Bánh bao gà nấm phomai',         gia:28000},
  {ten:'Bánh bao bò phomai',             gia:25000},
  {ten:'Bánh bao thịt trứng cút',        gia:20000},
  {ten:'Bánh bao hình thú',              gia:15000},
  {ten:'Bánh bao kimsa',                 gia:15000},
  {ten:'Bánh bao lava matcha',           gia:15000},
  {ten:'Cơm nắm xúc xích sốt teriyaki', gia:15000},
  {ten:'Cơm nắm xúc xích phomai',       gia:17000},
  {ten:'Yaourt',                          gia:10000},
];

var DENOMS = [500000,200000,100000,50000,20000,10000,5000,2000,1000];

// ── doGet: health check / product list ──────────────────────
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({success:true, products:PRODUCTS}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doPost: receive shift report, append row ─────────────────
function doPost(e) {
  try {
    var raw = (e && e.postData) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_CA);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_CA);
      var headers = buildHeaders();
      var hRange  = sheet.getRange(1, 1, 1, headers.length);
      hRange.setValues([headers]);
      hRange.setBackground('#c1502e');
      hRange.setFontColor('#ffffff');
      hRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow(buildRow(data));

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
function buildHeaders() {
  var h = ['Timestamp','Ngày','Vị trí','Tên'];

  // Per-product columns (11 cols each)
  PRODUCTS.forEach(function(p) {
    var n = '['+p.ten+'] ';
    h.push(n+'Đầu H1', n+'Đầu H2', n+'Đầu Kho',
           n+'Xuất', n+'Nhập', n+'Hư', n+'KM',
           n+'Cuối TT', n+'Dự kiến', n+'Lệch', n+'Doanh thu');
  });

  // Cash denominations
  DENOMS.forEach(function(d) { h.push('ĐC '+denomLabel(d)+' (tờ)'); });
  DENOMS.forEach(function(d) { h.push('CC '+denomLabel(d)+' (tờ)'); });

  h.push(
    'Tổng tiền ĐC', 'Tổng tiền CC',
    'Chi phí', 'DT chuyển khoản',
    'Tổng DT hàng', 'Lệch tiền',
    'Người giao', 'Người nhận', 'Ghi chú'
  );
  return h;
}

// ── Build data row from POST payload ────────────────────────
function buildRow(data) {
  var tz  = Session.getScriptTimeZone();
  var ts  = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');
  var row = [ts, data.ngay||'', data.vi_tri||'', data.ten||''];

  var totalRev = 0;

  (data.products||[]).forEach(function(v, i) {
    var p         = PRODUCTS[i] || {gia:0};
    var dau_h1    = Number(v.dau_h1)  || 0;
    var dau_h2    = Number(v.dau_h2)  || 0;
    var dau_kho   = Number(v.dau_kho) || 0;
    var xuat      = Number(v.xuat)    || 0;
    var nhap      = Number(v.nhap)    || 0;
    var hu        = Number(v.hu)      || 0;
    var km        = Number(v.km)      || 0;
    var cuoi_thuc = v.cuoi_thuc !== undefined && v.cuoi_thuc !== '' ? Number(v.cuoi_thuc) : '';
    var predicted = dau_h1 + dau_h2 + dau_kho + nhap - xuat - hu - km;
    var lech      = cuoi_thuc !== '' ? cuoi_thuc - predicted : '';
    // Tiêu thụ thực = Đầu + Nhập − Hư − KM − Tồn cuối (tính từ kiểm kho)
    var tieu_thu  = cuoi_thuc !== '' ? Math.max(0, dau_h1 + dau_h2 + dau_kho + nhap - hu - km - cuoi_thuc) : xuat;
    var dt        = tieu_thu * p.gia;
    totalRev += dt;

    row.push(dau_h1, dau_h2, dau_kho, xuat, nhap, hu, km, cuoi_thuc, predicted, lech, dt);
  });

  var tienDau  = data.tien_dau  || {};
  var tienCuoi = data.tien_cuoi || {};
  var tongDau  = 0;
  var tongCuoi = 0;

  DENOMS.forEach(function(d) { var n=Number(tienDau[d])||0;  row.push(n); tongDau  += n*d; });
  DENOMS.forEach(function(d) { var n=Number(tienCuoi[d])||0; row.push(n); tongCuoi += n*d; });

  var chiPhi  = Number(data.chi_phi) || 0;
  var dtNH    = Number(data.dt_nh)   || 0;
  var expected= tongDau + (totalRev - dtNH) - chiPhi;
  var lechTien= tongCuoi - expected;

  row.push(
    tongDau, tongCuoi,
    chiPhi, dtNH,
    totalRev, lechTien,
    data.nguoi_giao||'', data.nguoi_nhan||'', data.ghi_chu||''
  );

  return row;
}

function denomLabel(d) {
  return d >= 1000000 ? (d/1000000)+'tr' : d >= 1000 ? (d/1000)+'k' : String(d);
}

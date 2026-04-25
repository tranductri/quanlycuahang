// =============================================
// CẤU HÌNH
// =============================================
var SHEET_CA = 'ca_lam_viec';
var SHEET_SP = 'san_pham';

var FALLBACK_SP = [
  {ten: 'Bánh bao xúc xích phomai', gia: 20000},
  {ten: 'Bánh bao xá xíu phomai', gia: 22000},
  {ten: 'Bánh bao gà nấm phomai', gia: 28000},
  {ten: 'Bánh bao bò phomai', gia: 25000},
  {ten: 'Bánh bao thịt trứng cút', gia: 20000},
  {ten: 'Bánh bao hình thú', gia: 15000},
  {ten: 'Bánh bao kimsa', gia: 15000},
  {ten: 'Bánh bao lava matcha', gia: 15000},
  {ten: 'Cơm nắm xúc xích sốt teriyaki', gia: 15000},
  {ten: 'Cơm nắm xúc xích phomai tan chảy', gia: 17000},
  {ten: 'Yaourt', gia: 10000}
];

var MENH_GIA = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];
var MENH_GIA_LABEL = ['500k', '200k', '100k', '50k', '20k', '10k', '5k', '2k', '1k'];

var COT_SP = [
  'Tủ hấp 1 (mới)', 'Tủ hấp 1 (hộp)', 'Tủ hấp 2 (mới)', 'Đầu hấp',
  'Đầu ca kho', 'Nhập thêm', 'Hư hỏng', 'Khuyến mãi',
  'Xuất kho', 'Cuối ca kho', 'Cuối ca hấp', 'Tiêu thụ', 'Doanh thu'
];

// =============================================
// doGet — trả danh sách sản phẩm dạng JSON
// =============================================
function doGet(e) {
  var products = docSanPham();
  var result = JSON.stringify({success: true, products: products});
  return ContentService
    .createTextOutput(result)
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================
// doPost — nhận JSON, ghi 1 hàng vào sheet ca_lam_viec
// =============================================
function doPost(e) {
  try {
    var raw = (e && e.postData) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_CA);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_CA);
      var spList = (data.san_pham && data.san_pham.length) ? data.san_pham : FALLBACK_SP;
      var headers = taoHeader(spList);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setBackground('#1a73e8');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    var row = taoHang(data);
    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({success: true, message: 'Đã lưu ca thành công!'}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =============================================
// Đọc danh sách sản phẩm từ sheet san_pham
// =============================================
function docSanPham() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_SP);
    if (!sheet || sheet.getLastRow() < 2) return FALLBACK_SP;

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    var result = [];
    data.forEach(function (r) {
      if (r[0] && Number(r[1]) > 0) {
        result.push({ten: String(r[0]).trim(), gia: Number(r[1])});
      }
    });
    return result.length ? result : FALLBACK_SP;
  } catch (e) {
    return FALLBACK_SP;
  }
}

// =============================================
// Tạo dòng header cho sheet ca_lam_viec
// =============================================
function taoHeader(sanPham) {
  var h = ['Timestamp', 'Ngày', 'Vị trí', 'Giờ bắt đầu', 'Giờ kết thúc', 'Tên người kiểm'];

  sanPham.forEach(function (sp) {
    COT_SP.forEach(function (c) {
      h.push('[' + sp.ten + '] ' + c);
    });
  });

  MENH_GIA_LABEL.forEach(function (mg) { h.push('ĐC - ' + mg + ' (tờ)'); });
  MENH_GIA_LABEL.forEach(function (mg) { h.push('CC - ' + mg + ' (tờ)'); });

  h.push(
    'Tổng tiền đầu ca', 'Tổng tiền cuối ca',
    'Chi phí', 'DT ngân hàng',
    'Tổng DT theo hàng', 'Tổng DT theo tiền',
    'Chênh lệch', 'Lý do'
  );

  return h;
}

// =============================================
// Tạo dữ liệu 1 hàng từ payload JSON
// =============================================
function taoHang(data) {
  var tz = Session.getScriptTimeZone();
  var ts = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');

  var row = [
    ts,
    data.ngay || '',
    data.vi_tri || '',
    data.gio_bat_dau || '',
    data.gio_ket_thuc || '',
    data.ten_nguoi_kiem || ''
  ];

  (data.san_pham || []).forEach(function (sp) {
    row.push(
      Number(sp.tu_hap_1_moi) || 0,
      Number(sp.tu_hap_1_hop) || 0,
      Number(sp.tu_hap_2_moi) || 0,
      Number(sp.dau_hap)      || 0,
      Number(sp.dau_ca_kho)   || 0,
      Number(sp.nhap_them)    || 0,
      Number(sp.hu_hong)      || 0,
      Number(sp.khuyen_mai)   || 0,
      Number(sp.xuat_kho)     || 0,
      Number(sp.cuoi_ca_kho)  || 0,
      Number(sp.cuoi_ca_hap)  || 0,
      Number(sp.tieu_thu)     || 0,
      Number(sp.doanh_thu)    || 0
    );
  });

  var tDau = data.tien_dau_ca || {};
  var tCuoi = data.tien_cuoi_ca || {};
  var tongDau = 0, tongCuoi = 0;

  MENH_GIA.forEach(function (mg) {
    var so = Number(tDau[mg]) || 0;
    row.push(so);
    tongDau += so * mg;
  });
  MENH_GIA.forEach(function (mg) {
    var so = Number(tCuoi[mg]) || 0;
    row.push(so);
    tongCuoi += so * mg;
  });

  var tongHang = Number(data.tong_dt_hang) || 0;
  var tongTien  = Number(data.tong_dt_tien) || 0;

  row.push(
    tongDau,
    tongCuoi,
    Number(data.chi_phi)      || 0,
    Number(data.dt_ngan_hang) || 0,
    tongHang,
    tongTien,
    tongHang - tongTien,
    data.ly_do || ''
  );

  return row;
}

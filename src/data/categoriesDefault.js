const expense = [
  {
    tempId: '001',
    categoryName: 'Ăn uống',
    icon: null,
    childrenIds: ['002', '003', '004', '005', '006', '007'],
    parentId: null
  },
  {
    tempId: '002',
    categoryName: 'Ăn sáng',
    icon: null,
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '003',
    categoryName: 'Ăn tiệm',
    icon: null,
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '004',
    categoryName: 'Ăn tối',
    icon: null,
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '005',
    categoryName: 'Ăn trưa',
    icon: null,
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '006',
    categoryName: 'Cafe',
    icon: null,
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '007',
    categoryName: 'Đi chợ/siêu thị',
    icon: null,
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '008',
    categoryName: 'Con cái',
    icon: null,
    childrenIds: [ '009', '010', '011', '012', '013' ],
    parentId: null
  },
  {
    tempId: '009',
    categoryName: 'Đồ chơi',
    icon: null,
    childrenIds: [],
    parentId: '008'
  },
  {
    tempId: '010',
    categoryName: 'Học phí',
    icon: null,
    childrenIds: [],
    parentId: '008'
  },
  {
    tempId: '011',
    categoryName: 'Sách vở',
    icon: null,
    childrenIds: [],
    parentId: '008'
  },
  {
    tempId: '012',
    categoryName: 'Sữa',
    icon: null,
    childrenIds: [],
    parentId: '008'
  },
  {
    tempId: '013',
    categoryName: 'Tiền tiêu vặt',
    icon: null,
    childrenIds: [],
    parentId: '008'
  },
  {
    tempId: '014',
    categoryName: 'Dịch vụ sinh hoạt',
    icon: null,
    childrenIds: [
      '015', '016',
      '017', '018',
      '019', '020',
      '021', '022'
    ],
    parentId: null
  },
  {
    tempId: '015',
    categoryName: 'Điện',
    icon: null,
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '016',
    categoryName: 'Điện thoại cố định',
    icon: null,
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '017',
    categoryName: 'Điện thoại di động',
    icon: null,
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '018',
    categoryName: 'Gas',
    icon: null,
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '019',
    categoryName: 'Internet',
    icon: null,
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '020',
    categoryName: 'Nước',
    icon: null,
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '021',
    categoryName: 'Thuê người giúp việc',
    icon: null,
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '022',
    categoryName: 'Truyền hình',
    icon: null,
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '023',
    categoryName: 'Đi lại',
    icon: null,
    childrenIds: ['024', '025', '026', '027', '028', '029'],
    parentId: null
  },
  {
    tempId: '024',
    categoryName: 'Bảo hiểm xe',
    icon: null,
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '025',
    categoryName: 'Gửi xe',
    icon: null,
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '026',
    categoryName: 'Rửa xe',
    icon: null,
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '027',
    categoryName: 'Sửa chữa, bảo dưỡng xe',
    icon: null,
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '028',
    categoryName: 'Taxi/thuê xe',
    icon: null,
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '029',
    categoryName: 'Xăng xe',
    icon: null,
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '030',
    categoryName: 'Hiếu hỉ',
    icon: null,
    childrenIds: ['031', '032', '033', '034'],
    parentId: null
  },
  {
    tempId: '031',
    categoryName: 'Biếu tặng',
    icon: null,
    childrenIds: [],
    parentId: '030'
  },
  {
    tempId: '032',
    categoryName: 'Cưới xin',
    icon: null,
    childrenIds: [],
    parentId: '030'
  },
  {
    tempId: '033',
    categoryName: 'Ma chay',
    icon: null,
    childrenIds: [],
    parentId: '030'
  },
  {
    tempId: '034',
    categoryName: 'Thăm hỏi',
    icon: null,
    childrenIds: [],
    parentId: '030'
  },
  {
    tempId: '035',
    categoryName: 'Hưởng thụ',
    icon: null,
    childrenIds: ['036', '037', '038', '039', '040'],
    parentId: null
  },
  {
    tempId: '036',
    categoryName: 'Du lịch',
    icon: null,
    childrenIds: [],
    parentId: '035'
  },
  {
    tempId: '037',
    categoryName: 'Làm đẹp',
    icon: null,
    childrenIds: [],
    parentId: '035'
  },
  {
    tempId: '038',
    categoryName: 'Mỹ phẩm',
    icon: null,
    childrenIds: [],
    parentId: '035'
  },
  {
    tempId: '039',
    categoryName: 'Phim ảnh ca nhạc',
    icon: null,
    childrenIds: [],
    parentId: '035'
  },
  {
    tempId: '040',
    categoryName: 'Vui chơi giải trí',
    icon: null,
    childrenIds: [],
    parentId: '035'
  },
  {
    tempId: '041',
    categoryName: 'Ngân hàng',
    icon: null,
    childrenIds: ['042'],
    parentId: null
  },
  {
    tempId: '042',
    categoryName: 'Phí chuyển khoản',
    icon: null,
    childrenIds: [],
    parentId: '041'
  },
  {
    tempId: '043',
    categoryName: 'Nhà cửa',
    icon: null,
    childrenIds: ['044', '045', '046'],
    parentId: null
  },
  {
    tempId: '044',
    categoryName: 'Mua sắm đồ đạc',
    icon: null,
    childrenIds: [],
    parentId: '043'
  },
  {
    tempId: '045',
    categoryName: 'Sửa chữa nhà cửa',
    icon: null,
    childrenIds: [],
    parentId: '043'
  },
  {
    tempId: '046',
    categoryName: 'Thuê nhà',
    icon: null,
    childrenIds: [],
    parentId: '043'
  },
  {
    tempId: '047',
    categoryName: 'Phát triển bản thân',
    icon: null,
    childrenIds: ['048', '049'],
    parentId: null
  },
  {
    tempId: '048',
    categoryName: 'Giao lưu, quan hệ',
    icon: null,
    childrenIds: [],
    parentId: '047'
  },
  {
    tempId: '049',
    categoryName: 'Học hành',
    icon: null,
    childrenIds: [],
    parentId: '047'
  },
  {
    tempId: '050',
    categoryName: 'Sức khỏe',
    icon: null,
    childrenIds: ['051', '052', '053'],
    parentId: null
  },
  {
    tempId: '051',
    categoryName: 'Khám chữa bệnh',
    icon: null,
    childrenIds: [],
    parentId: '050'
  },
  {
    tempId: '052',
    categoryName: 'Thể thao',
    icon: null,
    childrenIds: [],
    parentId: '050'
  },
  {
    tempId: '053',
    categoryName: 'Thuốc men',
    icon: null,
    childrenIds: [],
    parentId: '050'
  },
  {
    tempId: '054',
    categoryName: 'Trang phục',
    icon: null,
    childrenIds: ['055', '056', '057'],
    parentId: null
  },
  {
    tempId: '055',
    categoryName: 'Giày dép',
    icon: null,
    childrenIds: [],
    parentId: '054'
  },
  {
    tempId: '056',
    categoryName: 'Phụ kiện khác',
    icon: null,
    childrenIds: [],
    parentId: '054'
  },
  {
    tempId: '057',
    categoryName: 'Quần áo',
    icon: null,
    childrenIds: [],
    parentId: '054'
  }
]

const income = [
  {
    tempId: '001',
    categoryName: 'Được cho/tặng',
    icon: null,
    childrenIds: [],
    parentId: null
  },
  {
    tempId: '002',
    categoryName: 'Khác',
    icon: null,
    childrenIds: [],
    parentId: null
  },
  {
    tempId: '003',
    categoryName: 'Lương',
    icon: null,
    childrenIds: [],
    parentId: null
  },
  {
    tempId: '004',
    categoryName: 'Thưởng',
    icon: null,
    childrenIds: [],
    parentId: null
  },
  {
    tempId: '005',
    categoryName: 'Tiền lãi',
    icon: null,
    childrenIds: [],
    parentId: null
  }
]

const loan = [
  {
    tempId: '001',
    categoryName: 'Cho vay',
    icon: null,
    childrenIds: [],
    parentId: null
  }
]

const borrowing = [
  {
    tempId: '001',
    categoryName: 'Đi vay',
    icon: null,
    childrenIds: [],
    parentId: null
  }
]

const transfer = [
  {
    tempId: '001',
    categoryName: 'Chuyển khoản',
    icon: null,
    childrenIds: [],
    parentId: null
  }
]

const contribution = [
  {
    tempId: '001',
    categoryName: 'Đóng góp',
    icon: null,
    childrenIds: [],
    parentId: null
  }
]

export const categoriesDefault = {
  expense,
  income,
  loan,
  borrowing,
  transfer,
  contribution
}

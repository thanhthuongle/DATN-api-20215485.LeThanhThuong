const expense = [
  {
    tempId: '001',
    categoryName: 'Ăn uống',
    icon: 'https://i.pinimg.com/736x/ef/e8/d3/efe8d36db6281666a126189f05bfeff1.jpg',
    childrenIds: ['002', '003', '004', '005', '006', '007'],
    parentId: null
  },
  {
    tempId: '002',
    categoryName: 'Ăn sáng',
    icon: 'https://i.pinimg.com/736x/52/9f/6e/529f6e99227d39471a414bf48e64bbf8.jpg',
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '003',
    categoryName: 'Ăn tiệm',
    icon: 'https://img.icons8.com/dusk/256/restaurant-table.png',
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '004',
    categoryName: 'Ăn tối',
    icon: 'https://img.icons8.com/arcade/256/dinner.png',
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '005',
    categoryName: 'Ăn trưa',
    icon: 'https://img.icons8.com/fluency/96/lunch.png',
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '006',
    categoryName: 'Cafe',
    icon: 'https://img.icons8.com/plasticine/100/cafe.png',
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '007',
    categoryName: 'Đi chợ/siêu thị',
    icon: 'https://img.icons8.com/color/240/shop.png',
    childrenIds: [],
    parentId: '001'
  },
  {
    tempId: '008',
    categoryName: 'Con cái',
    icon: 'https://img.icons8.com/color/240/babys-room.png',
    childrenIds: ['009', '010', '011', '012', '013'],
    parentId: null
  },
  {
    tempId: '009',
    categoryName: 'Đồ chơi',
    icon: 'https://img.icons8.com/arcade/256/ps-controller.png',
    childrenIds: [],
    parentId: '008'
  },
  {
    tempId: '010',
    categoryName: 'Học phí',
    icon: 'https://img.icons8.com/pulsar-color/240/education-fees-payment.png',
    childrenIds: [],
    parentId: '008'
  },
  {
    tempId: '011',
    categoryName: 'Sách vở',
    icon: 'https://img.icons8.com/plasticine/200/books.png',
    childrenIds: [],
    parentId: '008'
  },
  {
    tempId: '012',
    categoryName: 'Sữa',
    icon: 'https://img.icons8.com/color/240/baby-bottle.png',
    childrenIds: [],
    parentId: '008'
  },
  {
    tempId: '013',
    categoryName: 'Tiền tiêu vặt',
    icon: 'https://img.icons8.com/plasticine/200/money.png',
    childrenIds: [],
    parentId: '008'
  },
  {
    tempId: '014',
    categoryName: 'Dịch vụ sinh hoạt',
    icon: 'https://img.icons8.com/fluency/240/cloakroom.png',
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
    icon: 'https://img.icons8.com/arcade/256/idea.png',
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '016',
    categoryName: 'Điện thoại cố định',
    icon: 'https://img.icons8.com/fluency/240/phone-not-being-used.png',
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '017',
    categoryName: 'Điện thoại di động',
    icon: 'https://img.icons8.com/plasticine/200/iphone.png',
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '018',
    categoryName: 'Gas',
    icon: 'https://img.icons8.com/cotton/256/gas-industry.png',
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '019',
    categoryName: 'Internet',
    icon: 'https://img.icons8.com/papercut/240/internet.png',
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '020',
    categoryName: 'Nước',
    icon: 'https://img.icons8.com/arcade/256/water-tap-.png',
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '021',
    categoryName: 'Thuê người giúp việc',
    icon: 'https://img.icons8.com/officel/480/housekeeper-female.png',
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '022',
    categoryName: 'Truyền hình',
    icon: 'https://img.icons8.com/clouds/200/tv.png',
    childrenIds: [],
    parentId: '014'
  },
  {
    tempId: '023',
    categoryName: 'Đi lại',
    icon: 'https://img.icons8.com/color/240/map-marker--v1.png',
    childrenIds: ['024', '025', '026', '027', '028', '029'],
    parentId: null
  },
  {
    tempId: '024',
    categoryName: 'Bảo hiểm xe',
    icon: 'https://img.icons8.com/cotton/256/shield--v1.png',
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '025',
    categoryName: 'Gửi xe',
    icon: 'https://img.icons8.com/external-flaticons-lineal-color-flat-icons/256/external-parking-map-and-navigation-flaticons-lineal-color-flat-icons-3.png',
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '026',
    categoryName: 'Rửa xe',
    icon: 'https://img.icons8.com/external-wanicon-lineal-color-wanicon/256/external-car-wash-car-service-wanicon-lineal-color-wanicon.png',
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '027',
    categoryName: 'Sửa chữa, bảo dưỡng xe',
    icon: 'https://img.icons8.com/arcade/256/car-service.png',
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '028',
    categoryName: 'Taxi/thuê xe',
    icon: 'https://img.icons8.com/3d-fluency/375/taxi.png',
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '029',
    categoryName: 'Xăng xe',
    icon: 'https://img.icons8.com/color/480/gas-station.png',
    childrenIds: [],
    parentId: '023'
  },
  {
    tempId: '030',
    categoryName: 'Hiếu hỉ',
    icon: 'https://img.icons8.com/pieces/256/lotus.png',
    childrenIds: ['031', '032', '033', '034'],
    parentId: null
  },
  {
    tempId: '031',
    categoryName: 'Biếu tặng',
    icon: 'https://img.icons8.com/arcade/256/gift.png',
    childrenIds: [],
    parentId: '030'
  },
  {
    tempId: '032',
    categoryName: 'Cưới xin',
    icon: 'https://img.icons8.com/doodle/480/wedding-rings--v1.png',
    childrenIds: [],
    parentId: '030'
  },
  {
    tempId: '033',
    categoryName: 'Ma chay',
    icon: 'https://file.hstatic.net/200000427529/file/hoa-sen-trang-dam-tang-1633066696-q3mc0_e862815e10634a87922bc7ab610c9c63_grande.jpg',
    childrenIds: [],
    parentId: '030'
  },
  {
    tempId: '034',
    categoryName: 'Thăm hỏi',
    icon: 'https://img.icons8.com/officel/480/hospital-bed.png',
    childrenIds: [],
    parentId: '030'
  },
  {
    tempId: '035',
    categoryName: 'Hưởng thụ',
    icon: 'https://img.icons8.com/emoji/256/luggage-emoji.png',
    childrenIds: ['036', '037', '038', '039', '040'],
    parentId: null
  },
  {
    tempId: '036',
    categoryName: 'Du lịch',
    icon: 'https://img.icons8.com/3d-fluency/375/airplane-take-off.png',
    childrenIds: [],
    parentId: '035'
  },
  {
    tempId: '037',
    categoryName: 'Làm đẹp',
    icon: 'https://img.icons8.com/fluency/240/spa-mask.png',
    childrenIds: [],
    parentId: '035'
  },
  {
    tempId: '038',
    categoryName: 'Mỹ phẩm',
    icon: 'https://img.icons8.com/fluency/240/lip-gloss.png',
    childrenIds: [],
    parentId: '035'
  },
  {
    tempId: '039',
    categoryName: 'Phim ảnh ca nhạc',
    icon: 'https://img.icons8.com/fluency/240/film-reel--v1.png',
    childrenIds: [],
    parentId: '035'
  },
  {
    tempId: '040',
    categoryName: 'Vui chơi giải trí',
    icon: 'https://img.icons8.com/nolan/256/nintendo-switch-handheld.png',
    childrenIds: [],
    parentId: '035'
  },
  {
    tempId: '041',
    categoryName: 'Ngân hàng',
    icon: 'https://img.icons8.com/fluency/240/bank-building.png',
    childrenIds: ['042'],
    parentId: null
  },
  {
    tempId: '042',
    categoryName: 'Phí chuyển khoản',
    icon: 'https://img.icons8.com/ios-filled/250/exchange.png',
    childrenIds: [],
    parentId: '041'
  },
  {
    tempId: '043',
    categoryName: 'Nhà cửa',
    icon: 'https://img.icons8.com/plasticine/200/home.png',
    childrenIds: ['044', '045', '046'],
    parentId: null
  },
  {
    tempId: '044',
    categoryName: 'Mua sắm đồ đạc',
    icon: 'https://img.icons8.com/fluency/240/interior.png',
    childrenIds: [],
    parentId: '043'
  },
  {
    tempId: '045',
    categoryName: 'Sửa chữa nhà cửa',
    icon: 'https://img.icons8.com/fluency/240/workshop.png',
    childrenIds: [],
    parentId: '043'
  },
  {
    tempId: '046',
    categoryName: 'Thuê nhà',
    icon: 'https://img.icons8.com/fluency/240/sell-property.png',
    childrenIds: [],
    parentId: '043'
  },
  {
    tempId: '047',
    categoryName: 'Phát triển bản thân',
    icon: 'https://img.icons8.com/fluency/240/personal-growth.png',
    childrenIds: ['048', '049'],
    parentId: null
  },
  {
    tempId: '048',
    categoryName: 'Giao lưu, quan hệ',
    icon: 'https://img.icons8.com/stickers/200/handshake.png',
    childrenIds: [],
    parentId: '047'
  },
  {
    tempId: '049',
    categoryName: 'Học hành',
    icon: 'https://img.icons8.com/bubbles/200/graduation-cap.png',
    childrenIds: [],
    parentId: '047'
  },
  {
    tempId: '050',
    categoryName: 'Sức khỏe',
    icon: 'https://img.icons8.com/bubbles/200/trust.png',
    childrenIds: ['051', '052', '053'],
    parentId: null
  },
  {
    tempId: '051',
    categoryName: 'Khám chữa bệnh',
    icon: 'https://img.icons8.com/plasticine/200/stethoscope.png',
    childrenIds: [],
    parentId: '050'
  },
  {
    tempId: '052',
    categoryName: 'Thể thao',
    icon: 'https://img.icons8.com/color/240/strength.png',
    childrenIds: [],
    parentId: '050'
  },
  {
    tempId: '053',
    categoryName: 'Thuốc men',
    icon: 'https://img.icons8.com/color/240/pills.png',
    childrenIds: [],
    parentId: '050'
  },
  {
    tempId: '054',
    categoryName: 'Trang phục',
    icon: 'https://img.icons8.com/external-others-abderraouf-omara/256/external-fashion-love-and-romance-others-abderraouf-omara.png',
    childrenIds: ['055', '056', '057'],
    parentId: null
  },
  {
    tempId: '055',
    categoryName: 'Giày dép',
    icon: 'https://img.icons8.com/stickers/200/trainers--v1.png',
    childrenIds: [],
    parentId: '054'
  },
  {
    tempId: '056',
    categoryName: 'Phụ kiện khác',
    icon: 'https://img.icons8.com/scribby/200/bracelet.png',
    childrenIds: [],
    parentId: '054'
  },
  {
    tempId: '057',
    categoryName: 'Quần áo',
    icon: 'https://img.icons8.com/scribby/200/clothes.png',
    childrenIds: [],
    parentId: '054'
  },
  {
    tempId: '058',
    categoryName: 'Chi tiêu khác',
    icon: 'https://img.icons8.com/external-flaticons-lineal-color-flat-icons/256/external-expense-online-money-service-flaticons-lineal-color-flat-icons.png',
    childrenIds: [],
    parentId: null
  }
]

const income = [
  {
    tempId: '001',
    categoryName: 'Được cho/tặng',
    icon: 'https://img.icons8.com/pulsar-gradient/240/gift.png',
    childrenIds: [],
    parentId: null
  },
  {
    tempId: '002',
    categoryName: 'Lương',
    icon: 'https://img.icons8.com/bubbles/200/stack-of-money.png',
    childrenIds: [],
    parentId: null
  },
  {
    tempId: '003',
    categoryName: 'Thưởng',
    icon: 'https://img.icons8.com/plasticine/200/medal2-1.png',
    childrenIds: [],
    parentId: null
  },
  {
    tempId: '004',
    categoryName: 'Tiền lãi',
    icon: 'https://img.icons8.com/color/240/economic-improvement.png',
    childrenIds: [],
    parentId: null
  },
  {
    tempId: '005',
    categoryName: 'Nguồn thu khác',
    icon: 'https://img.icons8.com/ios-filled/250/income.png',
    childrenIds: [],
    parentId: null
  }
]

const loan = [
  {
    tempId: '001',
    categoryName: 'Cho vay',
    icon: 'https://img.icons8.com/external-goofy-flat-kerismaker/192/external-Loan-finance-goofy-flat-kerismaker.png',
    childrenIds: [],
    parentId: null
  }
]

const collect = [
  {
    tempId: '001',
    categoryName: 'Thu nợ',
    icon: 'https://img.icons8.com/external-soft-fill-juicy-fish/240/external-advice-financial-advice-soft-fill-soft-fill-juicy-fish-57.png',
    childrenIds: [],
    parentId: null
  }
]

const borrowing = [
  {
    tempId: '001',
    categoryName: 'Đi vay',
    icon: 'https://img.icons8.com/pulsar-color/240/debt.png',
    childrenIds: [],
    parentId: null
  }
]

const repayment = [
  {
    tempId: '001',
    categoryName: 'Trả nợ',
    icon: 'https://img.icons8.com/color/240/paid.png',
    childrenIds: [],
    parentId: null
  }
]

const transfer = [
  {
    tempId: '001',
    categoryName: 'Chuyển khoản',
    icon: 'https://img.icons8.com/fluency/240/transfer-money.png',
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
  collect,
  borrowing,
  repayment,
  transfer,
  contribution
}

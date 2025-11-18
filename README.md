# Nền tảng Dự báo Chất lượng Không khí Siêu địa phương và Điều hướng Xanh tại TP.HCM - UMT.FreeFireFiles

<a href="https://github.com/tannguyen1129/umtnewmountain/issues/new?assignees=&labels=bug&projects=&template=bug_report.md&title=%5BBug%5D%3A+%3CM%C3%B4+t%E1%BA%A3+ng%E1%BA%AFn+g%E1%BB%8Dn+v%E1%BB%81+l%E1%BB%97i%3E">Báo cáo lỗi (Bug Report)🆘🆘
</a>

<a href="https://github.com/tannguyen1129/umtnewmountain/issues/new?assignees=&labels=enhancement&projects=&template=feature.md&title=Y%C3%AAu+c%E1%BA%A7u+t%C3%ADnh+n%C4%83ng%3A+%5BT%C3%AAn+t%C3%ADnh+n%C4%83ng%5D">🧑‍🏫🧑‍🏫Feature Request (Yêu cầu thêm tính năng)
</a>

Green-AQI Navigator là một hệ thống microservices đầy đủ, được xây dựng hoàn toàn trên các tiêu chuẩn **Dữ liệu Mở Liên kết (LOD)** và **Web Ngữ nghĩa**.

Hệ thống sử dụng **FIWARE Orion-LD Context Broker** làm trung tâm thần kinh. Dữ liệu được thu thập, xử lý, và truy vấn dưới dạng các thực thể (Entities) JSON-LD đã được chuẩn hóa (sử dụng ontology của [SmartDataModels](https://smartdatamodels.org/)).

Dự án được thực hiện nhằm mục đích tham gia bảng [Phần mềm Nguồn Mở](https://www.olp.vn/procon-pmmn/ph%E1%BA%A7n-m%E1%BB%81m-ngu%E1%BB%93n-m%E1%BB%9F) trong khuôn khổ [Kỳ thi Olympic Tin học sinh viên Việt Nam lần thứ 34](https://www.olp.vn/olympic-tin-h%E1%BB%8Dc-sinh-vi%C3%AAn) tổ chức tại [Trường Đại học Công nghệ Thành phố Hồ Chí Minh](https://www.hutech.edu.vn/) từ ngày 09/12/2025 đến ngày 12/12/2025.

Phần mềm được đội ngũ tác giả của UMT.FreeFireFiles open source theo giấy phép [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0)

**Live Demo:** [DEMO](https://olp.umtoj.edu.vn/app/rescue-app/citizenpage-673f7d3ae443011fab9eaaab?branch=main)

## Mục lục tài liệu

1. [Giới Thiệu](#1-giới-thiệu)
2. [Tổng quan hệ thống](#2-tổng-quan-hệ-thống)
3. [Chức năng](#3-chức-năng)
4. [Screens Flow của dự án](#4-screens-flow-của-dự-án)
5. [Hướng dẫn cài đặt](#5-hướng-dẫn-cài-đặt)
    - [5.1.📋 Yêu cầu - Prerequisites](#51-Yêu-cầu)
    - [5.2.🔥 Dựng APIs](#52-dựng-apis-bằng-django)
    - [5.3.🔨 Cài đặt](#53-hướng-dẫn-cài-đặt)
6. [Đóng góp](#6-đóng-gópp)
7. [Liên lạc](#7-liên-lạc)
8. [License (Giấy phép)](#8-license)

# RESCUE SYSTEM - UMT.NEWMOUNTAIN 

<a href="https://github.com/tannguyen1129/umtnewmountain/issues/new?assignees=&labels=bug&projects=&template=bug_report.md&title=%5BBug%5D%3A+%3CM%C3%B4+t%E1%BA%A3+ng%E1%BA%AFn+g%E1%BB%8Dn+v%E1%BB%81+l%E1%BB%97i%3E">Báo cáo lỗi (Bug Report)🆘🆘
</a>

<a href="https://github.com/tannguyen1129/umtnewmountain/issues/new?assignees=&labels=enhancement&projects=&template=feature.md&title=Y%C3%AAu+c%E1%BA%A7u+t%C3%ADnh+n%C4%83ng%3A+%5BT%C3%AAn+t%C3%ADnh+n%C4%83ng%5D">🧑‍🏫🧑‍🏫Feature Request (Yêu cầu thêm tính năng)
</a>

Ứng dụng hỗ trợ điều phối, thông báo, cập nhật thông tin ứng phó thiên tai, tham họa. Ở dự án này nhóm tác giả chọn Appsimth để dựng Frontend và Django để dựng APIs Backend

Phát triển hệ thống ứng dụng công nghệ thông tin trong ứng phó và hỗ trợ khắc phục trong các tình huống khẩn cấp.

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

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

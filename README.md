# actbase-cli

React, React-Native Framework인 Actbase의 도움을 주는 CLI입니다.

해당 CLI를 통해 boilerplate 및 i18n설정을 할 수 있습니다.

```shell script
$ npm i -g actbase-cli
```

---


#### 프로젝트 시작하기 (공통)
```shell script
$ actbase init [Project name]
```

----


#### 언어팩 생성하기 (공통)
언어팩은 xls, csv, Google Spreadsheet 를 지원합니다.

Google Spreadsheet를 사용하려면 하단의 URL을 참고하세요.

https://www.freecodecamp.org/news/cjn-google-sheets-as-json-endpoint/

```shell script
$ actbase i18n
```



----


#### 코드푸시 반영하기 (React-Native Only)
appcenter의 코드푸시를 자동으로 설정해 줍니다.

우선 package.json에 설정이 되어있어야 합니다.

```json
{
  "name": "testname",
  "version": "0.0.1",
  "private": true,
  "appcenter_ios": "[ios appcenter key (ex : org/name) ]",
  "appcenter_and": "[android appcenter key (ex : org/name) ]",
}
```


```shell script
$ actbase codepush
```

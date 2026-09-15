# HFOI

合肥信息学竞赛成绩静态查询站，原生 HTML/CSS/JavaScript，无前端构建依赖。

## 本地预览与身份维护

安装 Node.js 22 或更新版本后，在本目录运行 `node tools/identity-server.cjs`。

- 身份核对：`http://127.0.0.1:4178/`
- 网站预览：`http://127.0.0.1:4178/index.html`
- 数据校验：`node tools/validate-data.cjs`
- 测试：`node --test tests/identity.test.cjs`

操作说明、数据结构和合并/拆分规则见 [身份维护说明](docs/identity-maintenance.md)。

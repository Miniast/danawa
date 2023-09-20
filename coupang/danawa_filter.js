"use strict";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const cheerio = require("cheerio");
const Crawler = require("crawler");
const dayjs = require("dayjs");
const fs = require("fs");
const constants = require("constants");
const { getLogger } = require("./lib/logger");
const logger = getLogger();

const resultFile = `./lib/filter.json`;
// const ProxyManager = {
//     index: 0,
//     proxies: require("./lib/proxies_dd.json"),
//     setProxy: function (options) {
//         let proxy = this.proxies[this.index];
//         this.index = ++this.index % this.proxies.length;
//         options.proxy = proxy;
//         options.limiter = Math.floor(Math.random() * 10);
//     },
// };

const groups = [
    "가전·TV",
    "컴퓨터·노트북·조립PC",
    "태블릿·모바일·디카",
    "아웃도어·스포츠·골프",
    "자동차·용품·공구",
    "가구·조명",
    "식품·유아·완구",
    "생활·주방·건강",
    "패션·잡화·뷰티",
    "반려동물·취미·사무",
    "여행·항공·호텔",
];

const urlPrefix = "https://www.danawa.com/globaljs/com/danawa/common/category/CategoryInfoByGroupLayer.php";

class Store {
    constructor() {
        this.crawler = new Crawler({
            rateLimit: 1000,
            debug: false,
            homogeneous: true,
            timeout: 20000,
            jquery: false,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
                Referer: "https://www.danawa.com/",
            },
            jar: false,
            gzip: false,
            agentOptions: {
                secureOptions: constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
            },
        });
        this.crawler
            .on("drain", () => {
                fs.writeFileSync(resultFile, JSON.stringify(this.globalCategory, null, 4), "utf8");
                logger.info(`Task Complete.`);
            })
            .on("schedule", options => {
                // ProxyManager.setProxy(options);
                // options.proxy = "http://s5.proxy.mayidaili.com:8123";
                // options.proxy = "http://192.168.99.94:8888";
                options.limiter = Math.floor(Math.random() * 20);
            });
    }

    start() {
        this.globalCategory = {};

        // if (!fs.existsSync(resultDir)) fs.mkdirSync(resultDir, { recursive: true });
        // if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

        logger.info(`Getting filter.`);
        groups.forEach((group, index) => {
            const realIndex = index + 10;
            this.crawler.queue({
                uri: `${urlPrefix}`,
                method: "GET",
                callback: this.getFilter.bind(this),
                qs: {
                    group: realIndex,
                    _: dayjs().valueOf(),
                },
                gene: [realIndex, group],
            });
        });
    }

    getFilter(err, res, done) {
        const [realIndex, group] = res.options.gene;
        if (err) {
            logger.error(`Error : ${err} on ${realIndex}`);
        } else if (res.statusCode !== 200 && res.statusCode !== 400) {
            logger.error(`Error with http ${res.statusCode} on ${realIndex}`);
        } else if (!res.body) {
            logger.error(`Error with empty body on ${realIndex}`);
        } else {
            const decodedHtml = res.body.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
                const decimal = parseInt(hex, 16);
                return String.fromCharCode(decimal);
            });
            const $ = cheerio.load(decodedHtml);
            const topCate = $("div.category__2depth__left");
            const getCate = fatherDiv => {
                const nowCate = {};
                let nowSubCateName = null;
                $(fatherDiv)
                    .find("> ul > li")
                    .each((_i, el) => {
                        let categoryCode = null;
                        if ($(el).children("a").length === 0) {
                            // second category
                            nowSubCateName = $(el).children("strong").text().trim();
                            nowCate[nowSubCateName] = {
                                name: nowSubCateName,
                                children: {},
                            };
                        } else {
                            // third category
                            const url = $(el).children("a").attr("href");
                            const name = $(el).children("a").text().trim();
                            if (url && url.startsWith("https://prod.danawa.com/list/?cate=")) {
                                categoryCode = $(el).attr("category-code");
                            }
                            const nowBottomCate = {
                                url,
                                categoryCode,
                            };
                            const subCate = $(el).children("div");
                            if (subCate.length !== 0) {
                                nowBottomCate["children"] = getCate(subCate);
                            }
                            if (nowSubCateName === null) nowCate[name] = { name, ...nowBottomCate };
                            else nowCate[nowSubCateName]["children"][name] = { name, ...nowBottomCate };
                        }
                    });

                return nowCate;
            };
            this.globalCategory[group] = {
                groupIndex: realIndex,
                name: group,
                children: getCate(topCate),
            };
            logger.info(`Got ${realIndex} ${group}.`);
        }
        return done();
    }
}

const store = new Store();
store.start();

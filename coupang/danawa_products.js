"use strict";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const cheerio = require("cheerio");
const constants = require("constants");
const Crawler = require("crawler");
const dayjs = require("dayjs");
const fs = require("fs");
const Papa = require("papaparse");
const { getLogger } = require("./lib/logger");
const logger = getLogger({
    console: true,
    file: "./log/danawa_products.log",
});

const resultFile = `./lib/products_1.csv`;

const filter = require("./lib/filter.json");
//const conditions = [["가전·TV"], ["컴퓨터·노트북·조립PC"], ["태블릿·모바일·디카"], ["식품·유아·완구"]];
const conditions = [["가전·TV"]];
const urlPrefix = "https://prod.danawa.com/list/ajax/getProductList.ajax.php";

const globalLwbMonth = "201001";
const globalUpbMonth = dayjs().add(1, "month").format("YYYYMM");

const cateMap = new Map();
const productsMap = new Map();
class Store {
    constructor() {
        this.crawler = new Crawler({
            rateLimit: 500,
            debug: false,
            //homogeneous: true,
            timeout: 20000,
            jquery: false,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
                Accept: "text/html, */*; q=0.01",
                Referer: "https://prod.danawa.com",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            gzip: false,
            agentOptions: {
                secureOptions: constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
            },
        });
        this.crawler
            .on("drain", () => {
                fs.writeFileSync(resultFile, "id,name,fullCate,topCateName\n", "utf8");

                productsMap.forEach((value, key) => {
                    fs.appendFileSync(
                        resultFile,
                        `${key},${value.name},${value.fullCate},${value.topCateName}\n`,
                        "utf8"
                    );
                });
                logger.info(`Total ${productsMap.size} products. Task Complete.`);
            })
            .on("schedule", options => {
                options.limiter = Math.floor(Math.random() * 30);
            });
    }

    start() {
        logger.info(`Getting Products.`);
        const info = fs.readFileSync("./lib/alterCate.csv", "utf8");
        Papa.parse(info, {
            header: true,
            step: row => {
                const { fullCate, alterCate, group } = row.data;
                const cate = fullCate.substring(3);
                cateMap.set(cate, { alterCate, group });
            },
        });
        const activateAvaliableUrls = (slicedFilter, topCateName) => {
            const { name, url } = slicedFilter;
            if (!url || !url.startsWith("https://prod.danawa.com/list/?cate=")) {
                for (const key in slicedFilter["children"]) {
                    activateAvaliableUrls(slicedFilter["children"][key], topCateName);
                }
            } else {
                const fullCate = new URLSearchParams(url.split("?")[1]).get("cate");
                const cate = fullCate.substring(3);
                if (!cateMap.has(cate)) {
                    logger.warn(`No alterCate for ${fullCate} and ${name}`);
                }
                const { alterCate, group } = cateMap.get(cate);
                this.crawler.queue({
                    uri: urlPrefix,
                    method: "POST",
                    body: Object.entries({
                        btnAllOptUse: true,
                        page: 1,
                        listCategoryCode: cate,
                        categoryCode: alterCate,
                        viewMethod: "LIST",
                        sortMethod: "NEW",
                        listCount: 150,
                        group: group,
                        registerDateRange: `${globalLwbMonth}~${globalUpbMonth}`,
                        sProductListApi: "search",
                    })
                        .map(([k, v]) => `${k}=${v}`)
                        .join("&"),
                    callback: this.getProducts.bind(this),
                    gene: {
                        name,
                        fullCate,
                        alterCate,
                        "page": 1,
                        group,
                        topCateName,
                        "lwbMonth": globalLwbMonth,
                        "upbMonth": globalUpbMonth,
                    },
                });
            }
        };

        conditions.forEach(condition => {
            let slicedFilter = filter;
            const topCateName = condition[0];
            condition.forEach((key, index) => {
                slicedFilter = slicedFilter[key];
                if (index !== condition.length - 1 && slicedFilter.children) {
                    slicedFilter = slicedFilter["children"];
                }
            });
            activateAvaliableUrls(slicedFilter, topCateName);
        });
    }

    getProducts(err, res, done) {
        const { name, fullCate, alterCate, page, group, topCateName, lwbMonth, upbMonth } = res.options.gene;
        if (err) {
            logger.error(`Error : ${err} on page ${page} of ${fullCate} and ${name} of ${lwbMonth}~${upbMonth}`);
        } else if (res.statusCode !== 200 && res.statusCode !== 400) {
            logger.error(
                `Error with http ${res.statusCode} on page ${page} of ${fullCate} and ${name} of ${lwbMonth}~${upbMonth}`
            );
        } else if (!res.body) {
            logger.error(`Error with empty body on page ${page} of ${fullCate} and ${name} of ${lwbMonth}~${upbMonth}`);
        } else {
            const decodedHtml = res.body.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
                const decimal = parseInt(hex, 16);
                return String.fromCharCode(decimal);
            });
            const $ = cheerio.load(decodedHtml);
            const totalProducts = parseInt($("input#totalProductCount").attr("value").replace(",", ""));
            const products_id_list = $("input#productCodeListForContent").attr("value").split(",");

            products_id_list.forEach(id => {
                productsMap.set(id, {
                    name,
                    fullCate,
                    topCateName,
                });
            });
            if (page === 1) {
                logger.info(
                    `Total Products on page ${page} of ${fullCate} and ${name} of ${lwbMonth}~${upbMonth} is ${totalProducts}`
                );
                if (lwbMonth === globalLwbMonth && upbMonth === globalUpbMonth) {
                    fs.appendFileSync(
                        "./result/total.csv",
                        `${name},${fullCate},${alterCate},${totalProducts}\n`,
                        "utf8"
                    );
                }
                const totalPages = Math.ceil(totalProducts / 150);
                const cate = fullCate.substring(3);
                const crawlerBody = {
                    btnAllOptUse: true,
                    page: 1,
                    listCategoryCode: cate,
                    categoryCode: alterCate,
                    viewMethod: "LIST",
                    sortMethod: "NEW",
                    listCount: 150,
                    group: group,
                    registerDateRange: `${lwbMonth}~${upbMonth}`,
                    sProductListApi: "search",
                };
                const crawlerGene = {
                    name,
                    fullCate,
                    alterCate,
                    page: 1,
                    group,
                    topCateName,
                    lwbMonth,
                    upbMonth,
                };

                // every 13 pages, the data will be limited
                // try to slice the data into 13 parts and divided by date
                if (totalPages > 13) {
                    logger.info(
                        `Products exceeds: ${fullCate} - ${name} - ${totalProducts} - ${lwbMonth} - ${upbMonth}`
                    );
                    const duration = dayjs(upbMonth).diff(dayjs(lwbMonth), "month");
                    const midMonth = dayjs(lwbMonth)
                        .add(Math.floor(duration / 2), "month")
                        .format("YYYYMM");
                    const midMonthPlus = dayjs(midMonth).add(1, "month").format("YYYYMM");

                    this.crawler.queue({
                        uri: urlPrefix,
                        method: "POST",
                        body: Object.entries({
                            ...crawlerBody,
                            registerDateRange: `${lwbMonth}~${midMonth}`,
                        })
                            .map(([k, v]) => `${k}=${v}`)
                            .join("&"),
                        callback: this.getProducts.bind(this),
                        gene: {
                            ...crawlerGene,
                            lwbMonth,
                            upbMonth: midMonth,
                        },
                    });
                    this.crawler.queue({
                        uri: urlPrefix,
                        method: "POST",
                        body: Object.entries({
                            ...crawlerBody,
                            registerDateRange: `${midMonthPlus}~${upbMonth}`,
                        })
                            .map(([k, v]) => `${k}=${v}`)
                            .join("&"),
                        callback: this.getProducts.bind(this),
                        gene: {
                            ...crawlerGene,
                            lwbMonth: midMonthPlus,
                            upbMonth,
                        },
                    });
                } else {
                    for (let nowPage = 2; nowPage <= totalPages; nowPage++) {
                        this.crawler.queue({
                            uri: urlPrefix,
                            method: "POST",
                            body: Object.entries({
                                ...crawlerBody,
                                page: nowPage,
                            })
                                .map(([k, v]) => `${k}=${v}`)
                                .join("&"),
                            callback: this.getProducts.bind(this),
                            gene: {
                                ...crawlerGene,
                                page: nowPage,
                            },
                        });
                    }
                }
            } else {
                logger.info(`Products on page ${page} of ${fullCate} and ${name} of ${lwbMonth}~${upbMonth} Done.`);
            }
        }
        return done();
    }
}

const store = new Store();
store.start();

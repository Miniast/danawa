"use strict";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const constants = require("constants");
const Crawler = require("crawler");
const dayjs = require("dayjs");
const fs = require("fs");
const Papa = require("papaparse");
const { getLogger } = require("./lib/logger");
const logger = getLogger({
    console: true,
    file: "./log/danawa_detail.log",
});

const resultFilePrefix = `./result/products_${dayjs().format("YYYY-MM-DD")}`;

const urlPrefix = "https://prod.danawa.com/info/";

class Store {
    constructor() {
        this.crawler = new Crawler({
            rateLimit: 500,
            debug: false,
            //homogeneous: true,
            timeout: 20000,
            jQuery: true,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
                Referer: "https://prod.danawa.com",
            },
            gzip: false,
            agentOptions: {
                secureOptions: constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
            },
        });
        this.crawler
            .on("drain", () => {})
            .on("schedule", options => {
                options.limiter = Math.floor(Math.random() * 30);
            });
    }

    start() {
        logger.info(`Getting Products.`);
        const info = fs.readFileSync("./lib/products.csv", "utf8");
        Papa.parse(info, {
            header: true,
            step: row => {
                const { id, name: cateName, fullCate, topCateName } = row.data;
                if (!id || id === "") return;
                this.crawler.queue({
                    uri: `${urlPrefix}`,
                    method: "GET",
                    qs: {
                        pcode: id,
                    },
                    callback: this.getProduct.bind(this),
                    gene: { id, cateName, fullCate, topCateName },
                });
            },
        });
    }

    getProduct(err, res, done) {
        const { id, cateName, fullCate, topCateName } = res.options.gene;
        if (err) {
            logger.error(`Error : ${err} on id ${id} of ${fullCate} and ${cateName}`);
        } else if (res.statusCode !== 200 && res.statusCode !== 400) {
            logger.error(`Error with http ${res.statusCode} on id ${id} of ${fullCate} and ${cateName}`);
        } else if (!res.body) {
            logger.error(`Error with empty body on id ${id} of ${fullCate} and ${cateName}`);
        } else {
            const resultFile = `${resultFilePrefix}_${topCateName}.csv`;
            if (!fs.existsSync(resultFile))
                fs.writeFileSync(resultFile, "id,title,cateName,fullCate,mall,price,ship,totalPrice,shipTime\n");
            const $ = res.$;
            const title = $("div.top_summary span.title").text().trim();
            const table = $("table.lwst_tbl");
            table.find("tbody.high_list > tr[class!='product-pot']").each((_i, tr) => {
                const row = [id, title, cateName, fullCate];
                $(tr)
                    .find("td")
                    .each((_j, td) => {
                        // do by class
                        const tdClass = $(td).attr("class").trim();
                        switch (tdClass) {
                            case "mall": {
                                const mall = $(td).find("img").attr("alt");
                                row.push(mall);
                                break;
                            }
                            case "price": {
                                const price = $(td).find("span.txt_prc > em.prc_t").text();
                                row.push(parseInt(price.replace(/,/g, "")));
                                break;
                            }
                            case "ship": {
                                const shipPriceStr = $(td)
                                    .find("span.stxt.deleveryBaseSection")
                                    .text()
                                    .replace(/,/g, "");
                                const shipPrice = shipPriceStr.match(/\d+/g);
                                const oriPrice = row[row.length - 1];
                                if (shipPrice === null) {
                                    row.push(0, oriPrice);
                                } else {
                                    row.push(parseInt(shipPrice[0]), parseInt(shipPrice[0]) + oriPrice);
                                }
                                break;
                            }
                            case "bnfit": {
                                const bnfit = $(td).find("a.stxt").text().trim();
                                row.push(bnfit);
                                break;
                            }
                        }
                    });
                const record = row.map(cell =>
                    cell
                        ? cell.replace
                            ? cell
                                  .replace(/,/g, "，")
                                  .replace(/[\r\n\s]+/g, " ")
                                  .replace(/"/g, "“")
                            : cell
                        : cell
                );
                fs.appendFileSync(resultFile, `${record}\n`);
            });
        }
        logger.info(`Got product ${id} of ${fullCate} and ${cateName}`);
        return done();
    }
}

const store = new Store();
store.start();

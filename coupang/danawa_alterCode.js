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
    file: "./log/danawa_alterCodes.log",
});

const resultFile = `./lib/products.csv`;

const filter = require("./lib/filter.json");

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
                Referer: "https://prod.danawa.com",
            },
            gzip: false,
            agentOptions: {
                secureOptions: constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
            },
        });
        this.crawler
            .on("drain", () => {
                logger.info(`Task Complete.`);
            })
            .on("schedule", options => {
                options.limiter = Math.floor(Math.random() * 30);
            });
    }

    start() {
        logger.info(`Getting alterCodes.`);
        fs.writeFileSync("./lib/alterCate.csv", "fullCate,alterCate,group\n", "utf8");
        const activateAvaliableUrls = (filter, group) => {
            const { url, children } = filter;
            if (filter.groupIndex) group = filter.groupIndex;
            if (url && url.startsWith("https://prod.danawa.com/list/?cate=")) {
                this.crawler.queue({
                    uri: url,
                    method: "GET",
                    callback: this.getCode.bind(this),
                    gene: group,
                });
            }
            if (children) Object.values(children).forEach(child => activateAvaliableUrls(child, group));
        };
        Object.values(filter).forEach(filter => {
            activateAvaliableUrls(filter, null);
        });
    }

    getCode(err, res, done) {
        const webUrl = res.options.uri;
        const group = res.options.gene;
        if (err) {
            logger.error(`Error : ${err} on ${webUrl}`);
        } else if (res.statusCode !== 200) {
            logger.error(`Error with http ${res.statusCode} on ${webUrl}`);
        } else if (!res.body) {
            logger.error(`Error with empty body on ${webUrl}.`);
        } else {
            const fullCate = new URLSearchParams(webUrl.split("?")[1]).get("cate");
            const cate = fullCate.substring(3);
            const $ = res.$;
            let alterCate = "";
            try {
                alterCate = $('link[rel="alternate"]').attr("href").split("=")[1].substring(3);
            } catch (e) {
                alterCate = cate;
            }
            fs.appendFileSync("./lib/alterCate.csv", `${fullCate},${alterCate},${group}\n`, "utf8");
            logger.info(`Getting Products on ${webUrl} and code ${alterCate}`);
        }
        return done();
    }
}

const store = new Store();
store.start();

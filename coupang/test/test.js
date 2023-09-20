const cheerio = require("cheerio");
const fs = require("fs");
// const a = fs.readFileSync("./filter11.html", "utf8");
// const $ = cheerio.load(a);
// fs.writeFileSync("./filter11_n.html", $.html(), "utf8");
const a = fs.readFileSync('./2.html', 'utf8');
const $ = cheerio.load(a);
fs.writeFileSync('./2_n.html', $.html(), 'utf8');
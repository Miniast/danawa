const { createLogger, format, transports } = require("winston");
const fs = require("fs");
const path = require("path");

const getLogger = (options = {}) => {
    const env = process.env.NODE_ENV || "development";
    const { console: inConsole, file: logFile } = options;

    // Create the log directory if it does not exist
    if (logFile) {
        const absLogFile = path.resolve(logFile)
        if (absLogFile.includes("/")) {
            const logDir = absLogFile.split("/").slice(0, -1).join("/");
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
    }
    let logTransports = [];
    if (Object.keys(options).length === 0 || inConsole) {
        logTransports.push(
            new transports.Console({
                level: "info",
            })
        );
    }
    if (logFile) {
        logTransports.push(
            new transports.File({
                filename: logFile,
                level: "debug",
            })
        );
    }

    return createLogger({
        format: format.combine(
            format.colorize(),
            format.prettyPrint(),
            format.label({ label: path.basename(require.main.filename) }),
            format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            format.printf(info => `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`)
        ),
        transports: logTransports,
    });
};

module.exports = { getLogger };

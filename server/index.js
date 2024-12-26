const net = require("net");
const cp = require("child_process");

const config = require("./config.json");

const server = net.createServer();

server.on("connection", socket => {
    log(`Connection from ${socket.remoteAddress.split("::ffff:")[1] || socket.remoteAddress}`);
    let timeout;
    if (config.timeout) timeout = setTimeout(() => socket.destroy(), config.timeout);
    socket.on("data", data => {
        clearTimeout(timeout);
        const string = data.toString();
        const header = string.match(/^COMPUTER\/([\d.]+)\r\n(.*)/s);
        if (!header) {
            log("Invalid header from client");
            return socket.destroy();
        }
        const version = header[1];
        const arg = header[2];
        if (arg === "SHUTDOWN") {
            socket.end("COMPUTER/1.0\r\nOK");
            cp.exec(config.shutdownCmd);
        } else if (!arg) {
            socket.end(`COMPUTER/1.0\r\n${JSON.stringify(getServerInfo())}`);
        }
    });
});

server.listen(config.port, () => console.log(`Server listening on port ${config.port}`));

function log(...msg) {
    console.log(`[${new Date().toUTCString()}]`, ...msg);
}

function getServerInfo() {
    return {
        date: new Date(),
        uptime: Math.floor(process.uptime() * 1000),
    }
}
const Server = require("./http/Server");
const fs = require("fs");
const net = require("net");
const dgram = require("dgram");

const config = require("./config.json");

const page = fs.readFileSync("./index.html", "utf-8");
const server = new Server();

server.get("/", (req, res) => {
    res.html(page);
});

server.get("/info", async (req, res) => {
    try {
        const serverInfo = await getServerInfo();
        res.json(serverInfo);
    } catch (err) {
        res.sendStatus(500);
    }
});

server.get("/state", async (req, res) => {
    res.json(await getState());
});

server.post("/state/on", (req, res) => {
    sendOn();
});

server.post("/state/off", async (req, res) => {
    sendOff();
});

server.post("/state/toggle", async (req, res) => {
    if (await getState()) sendOff(); else sendOn();
});

server.any("*", (req, res) => {
    res.setStatus(404).send("Not found");
});

server.listen(config.serverPort, () => console.log(`Server listening on port ${config.serverPort}`));

async function getState() {
    try {
        await getServerInfo();
        return 1;
    } catch (err) {
        return 0;
    }
}

function sendOn() {
    return sendWOL();
}

function sendOff() {
    return sendServer("SHUTDOWN");
}

function getServerInfo(address = config.address, port = config.port) {
    return sendServer("", address, port).then(JSON.parse);
}

function sendServer(arg = "", address = config.address, port = config.port) {
    return new Promise((resolve, reject) => {
        let timeout;
        if (config.timeout) timeout = setTimeout(() => reject("Timed out"), config.timeout);
        const socket = net.createConnection({ host: address, port });
        socket.on("connect", () => {
            socket.write(`COMPUTER/1.0\r\n${arg}`);
        });
        socket.on("data", data => {
            clearTimeout(timeout);
            const string = data.toString();
            const header = string.match(/^COMPUTER\/([\d.]+)\r\n(.*)/s);
            if (!header) reject("Invalid header from server");
            const version = header[1];
            const arg = header[2];
            resolve(arg);
            socket.end();
        });
        socket.on("error", reject);
    });
}

function sendWOL(address = config.address, macAddress = config.macAddress, port = config.wakeOnLanPort) {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket("udp4");
        const macAddressBuffer = Buffer.from(macAddress.split(":").map(hex => parseInt(hex, 16)));
        const magicPacket = Buffer.from([
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
            ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer, ...macAddressBuffer
        ]);
        socket.send(magicPacket, port, address, err => {
            socket.close();
            if (err) reject(err);
            resolve();
        });
    });
}
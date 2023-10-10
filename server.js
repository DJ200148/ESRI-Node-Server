const express = require("express");
const puppeteer = require("puppeteer");
const EventEmitter = require("events");

const app = express();

const esriReady = new EventEmitter();

// Serve static files from the 'wwwroot' directory
app.use(express.static("wwwroot"));

// Middleware to parse JSON request bodies
app.use(express.json());

// Init the page
async function preloadPage() {
    browser = await puppeteer.launch({headless: 'new'});
    page = await browser.newPage();
    page.on("console", (msg) => {
        console.log(msg.text());
        if (msg.text() == "esirModules loaded") {
            esriReady.emit("ready");
        }
    });
    page.setDefaultTimeout(0)
    console.log("server ready");
    await page.goto("http://localhost:5000/rtest.html");
}

const port = 5000;
app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
    await preloadPage();
});

let esriLoaded = new Promise((resolve) => {
    esriReady.once("ready", resolve);
});

app.post("/", async (req, res) => {
    try {
        // Test Data
        // const geometries1 = [
        //     [
        //         [-118.51396376607275, 34.02710476636926],
        //         [-118.49171694356788, 34.04952826335747],
        //         [-118.45770497454605, 34.0621997913831],
        //         [-118.44016421064795, 34.0396023872462],
        //         [-118.49535344340042, 34.01097036391763],
        //     ],
        // ];

        // const geometries2 = [
        //     [
        //         [-118.49541651235003, 34.01100505430769],
        //         [-118.44024571838737, 34.0395830075338],
        //         [-118.42307174348817, 34.01681229166094],
        //         [-118.47314018574822, 33.983766706373615],
        //     ],
        // ];

        // Prepare the data to send to the HTML page
        const dataToSend = req.body.data;
        await esriLoaded;
        console.log("Esri is ready, running function");

        let mergedGeometries;

        // Define your geometries here
        try {
            mergedGeometries = await page.evaluate(async (data) => {
                const result = await window.MergeEsriRings(data);
                return result;
            }, dataToSend);
        } catch (error) {
            console.error("Error in page.evaluate:", error);

            if (error.message.includes("Out of memory")) {
                console.log("Reloading page due to out-of-memory error");
                await page.reload();
                await preloadPage();
                esriLoaded = new Promise((resolve) => {
                    esriReady.once("ready", resolve);
                });
                await esriLoaded;
                mergedGeometries = await page.evaluate(async (data) => {
                    const result = await window.MergeEsriRings(data);
                    return result;
                }, dataToSend);
                return res.json({ mergedGeometries });
            }
            throw error;
        }

        // Send the result back as JSON
        res.json({ mergedGeometries });
    } 
    catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


let Challenge2 = function(){
    let self = this;
    self.data = {};
    self.middleMap = new Graph();
    self.osp = [];
    function loadCSV(filename){
        return new Promise(function(fulfill,reject){
            d3.csv(filename,function(data){
                console.log(data);
                fulfill(data);
            });
        });
    }

    function init(){
        loadData().then(function(){
            loadMiddleMap();
            // loadOSPs();
        });
    }
    self.init = init;

    function createSensors(){
        let sensors = {};
        let chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene','AGOC-3A'];
        for(let i = 1; i <= 9; ++i){
            sensors[`sensor${i}`] = {};
            let curSensor = sensors[`sensor${i}`];
            for(let c of chemical_names){
                curSensor[c] = [];
            }
        }
        return sensors;
    }

    function ensureEntryExistence(date,db, newEntryFn){
        if(!db[date]){
            db[date] = newEntryFn();
        }
    }

    function getTimeEntry(time,db, newEntryFn){
        ensureEntryExistence(time, db, newEntryFn);
        return db[time];
    }

    function loadData(){
        let windLoad = loadCSV('data/Meteorological Data.csv');
        let chemicalLoad = loadCSV('data/Sensor Data.csv');

        //load data
        let count = 0;
        let statistics = {
            chemical: {
                Appluimonia:{
                    min: Infinity,
                    max: -Infinity,
                    amount: 0
                },
                Chlorodinine: {
                    min: Infinity,
                    max: -Infinity,
                    amount: 0
                },
                Methylosmolene: {
                    min: Infinity,
                    max: -Infinity,
                    amount: 0
                },
                'AGOC-3A': {
                    min: Infinity,
                    max: -Infinity,
                    amount: 0
                }
            },
            wind: {
                min: Infinity,
                max: -Infinity,
                amount: 0
            }
        }
        return Promise.all([windLoad,chemicalLoad])
            .then(function(results){
                
                return{
                    wind: results[0],
                    chemical: results[1]
                };
            }).then(function(data){
                //key objects by timestamp (<db_variable>[time_stamp] = <data>)
                let wind = {};
                let ignored_count = 0;
                for(let w of data.wind){
                    if (w.Date.length === 0 && w["Wind Speed (m/s)"].length === 0 && w["Wind Direction"].length === 0){
                        ignored_count++;
                        continue;
                    }

                    if (w.Date.length === 0 || w["Wind Speed (m/s)"].length === 0 || w["Wind Direction"].length === 0){
                        console.log("Wind entry may be invalid",w);
                    }

                    // let curTime = new Date(w.Date);
                    let timeEntry = getTimeEntry(w.Date, wind, function(){
                        return [];
                    });


                    let statEntry = statistics.wind;
                    let speed = parseFloat(w["Wind Speed (m/s)"]);
                    if (!isNaN(speed)){
                        statEntry.max = (speed > statEntry.max) ? speed : statEntry.max;
                        statEntry.min = (speed < statEntry.min) ? speed : statEntry.min;
                        statEntry.amount++;
                    }else{
                        console.log("Possibly erronous wind value", w);
                    }

                    timeEntry.push({
                        speed: speed,
                        direction: parseFloat(w["Wind Direction"])
                    });
                    if(timeEntry.length !== 1){
                        console.log("Wind Data Error:",w.Date,timeEntry);
                    }
                }
                console.log("Ignored",ignored_count,"empty wind entries");

                let chemical = {};
                let erroneous = [];
                for(let c of data.chemical){
                    // let curTime = new Date(c["Date Time "]);
                    let timeEntry = getTimeEntry(c["Date Time "],chemical, createSensors);

                    //update statistic info
                    let statEntry = statistics.chemical[c.Chemical];
                    let value = parseFloat(c.Reading);
                    if(!isNaN(value)){
                        statEntry.max = (value > statEntry.max) ? value : statEntry.max;
                        statEntry.min = (value < statEntry.min) ? value : statEntry.min;
                        statEntry.amount++;
                    }else{
                        console.log("Possibly erroneous chemical value", c);
                    }

                    timeEntry[`sensor${c.Monitor}`][c.Chemical].push(value);
                    if(timeEntry[`sensor${c.Monitor}`][c.Chemical].length !== 1)
                        erroneous.push({
                            msg: `Chemical Data Error: More than 1 entry exists. ${c["Data Time "]}, sensor${c.Monitor}, ${c.Chemical}`, 
                            data: timeEntry[`sensor${c.Monitor}`][c.Chemical]
                        });
                }
                console.log("Potentially Erroneous Chemical Data:\n",erroneous);


                self.data = {
                    wind: wind,
                    chemical: chemical
                };

                self.data.wind._statistics = statistics.wind;
                self.data.chemical._statistics = statistics.chemical;
                console.log("Done. Number of erronous chemical entries",count);
                // console.log(min,max);
                return;
            });
    }
    this.loadData = loadData;

    function loadMiddleMap(){
        self.middleMap.init();
    }
    // self.loadMiddleMap = loadMiddleMap;

    function loadOSPs(){
        let osp = new OverviewScatterPlot(d3.select('#osp-container-1'),1);
        osp.init();
        console.log("Loaded OSPs");
    }
};
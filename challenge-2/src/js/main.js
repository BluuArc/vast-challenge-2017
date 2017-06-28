
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
        return loadData().then(function(){
            loadMiddleMap();
            // loadOSPs();

            return;
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

                //create linear scales for each statistic
                for(let chem in statistics.chemical){
                    let curStat = statistics.chemical[chem];
                    curStat.scale = d3.scaleLinear().domain([(curStat.min < 0) ? curStat.min : 0, curStat.max]);
                }

                statistics.wind.scale = d3.scaleLinear().domain([statistics.wind.max,statistics.wind.max]);

                self.data.wind._statistics = statistics.wind;
                self.data.chemical._statistics = statistics.chemical;
                console.log("Done loading data. Number of erronous chemical entries",count);
                // console.log(min,max);
                return;
            });
    }
    this.loadData = loadData;

    function loadMiddleMap(){
        let options = {
            scales: {
                Appluimonia: self.data.chemical._statistics.Appluimonia.scale,
                Chlorodinine: self.data.chemical._statistics.Chlorodinine.scale,
                Methylosmolene: self.data.chemical._statistics.Methylosmolene.scale,
                'AGOC-3A': self.data.chemical._statistics['AGOC-3A'].scale,
                wind: self.data.wind._statistics.scale
            }
        }
        self.middleMap.init(options);
    }
    // self.loadMiddleMap = loadMiddleMap;
    function getDataAtTimeStamp(time){
        let chemical = self.data.chemical[time];
        let wind = self.data.wind[time];
        return {
            chemical: chemical,
            wind: wind
        };
    }

    function updateMiddleMap(sensorObject){
        if(typeof sensorObject === "string"){
            sensorObject = getDataAtTimeStamp(sensorObject);
        }
        self.middleMap.update(sensorObject);
    }
    self.updateMiddleMap = updateMiddleMap;

    function getChemicalTimeStamps(){
        let timestamps = Object.keys(self.data.chemical);
        timestamps = timestamps.filter((d) => {
            return (new Date(d)) != "Invalid Date"; //filter out non-timestamp keys
        });
        return timestamps;
    }
    self.getChemicalTimeStamps = getChemicalTimeStamps;

    function loadOSPs(){
        let osp = new OverviewScatterPlot(d3.select('#osp-container-1'),1);
        osp.init();
        console.log("Loaded OSPs");
    }
};
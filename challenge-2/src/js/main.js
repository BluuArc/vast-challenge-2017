
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

    function ensureEntryExistence(year,month,day,hour,db, newEntryFn){
        if(!db[year]){
            db[year] = {};
        }
        if(!db[year][month]){
            db[year][month] = {};
        }
        if(!db[year][month][day]){
            db[year][month][day] = {};
        }
        if(!db[year][month][day][hour]){
            db[year][month][day][hour] = newEntryFn();
        }
    }

    function getTimeEntry(time,db, newEntryFn){
        let [year, month, day, hour] = [time.getFullYear().toString(), time.getMonth().toString(), time.getDate().toString(), time.getHours().toString()];
        ensureEntryExistence(year, month, day, hour, db, newEntryFn);
        return db[year][month][day][hour];
    }

    function loadData(){
        let windLoad = loadCSV('data/Meteorological Data.csv');
        let chemicalLoad = loadCSV('data/Sensor Data.csv');

        //load data
        let count = 0;
        let max = -Infinity, min = Infinity;
        return Promise.all([windLoad,chemicalLoad])
            .then(function(results){
                
                return{
                    wind: results[0],
                    chemical: results[1]
                };
            }).then(function(data){
                //key objects by timestamp (<db_variable>[year][month][day][hour] = <data>)
                let wind = {};
                for(let w of data.wind){
                    let curTime = new Date(w.Date);
                    getTimeEntry(curTime, wind, function(){
                        return {
                            speed: w["Wind Speed (m/s)"],
                            direction: w["Wind Direction"]
                        };
                    });
                }

                let chemical = {};
                for(let c of data.chemical){
                    let curTime = new Date(c["Date Time "]);
                    let timeEntry = getTimeEntry(curTime,chemical, createSensors);
                    max = (c.Reading > max) ? c.Reading : max;
                    min = (c.Reading < min) ? c.Reading : min;
                    timeEntry[`sensor${c.Monitor}`][c.Chemical].push(c.Reading);
                    if(timeEntry[`sensor${c.Monitor}`][c.Chemical].length !== 1)
                        console.log(++count,curTime, `sensor${c.Monitor}`, c.Chemical, timeEntry[`sensor${c.Monitor}`][c.Chemical], c.Reading);
                }
                self.data = {
                    wind: wind,
                    chemical: chemical
                };
                console.log("Done. Number of erronous chemical entries",count);
                console.log(min,max);
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
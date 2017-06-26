
let Challenge2 = function(){
    let self = this;
    self.data = {};
    self.middleMap = new Graph(d3.min([d3.select('.container>.row').node().offsetWidth, d3.select('.container>.row').node().offsetHeight]));
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
            loadOSPs();
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
                //key objects by timestamp
                let wind = {};
                for(let w of data.wind){
                    if(wind[w.Date]){
                        console.log(`${w.Date} already exists`);
                    }
                    wind[w.Date] = {
                        speed: w["Wind Speed (m/s)"],
                        direction: w["Wind Direction"]
                    };
                }

                let chemical = {};
                for(let c of data.chemical){
                    let curTime = c["Date Time "];
                    if(!chemical[curTime]){
                        chemical[curTime] = createSensors();
                    }
                    max = (c.Reading > max) ? c.Reading : max;
                    min = (c.Reading < min) ? c.Reading : min;
                    chemical[curTime][`sensor${c.Monitor}`][c.Chemical].push(c.Reading);
                    if(chemical[curTime][`sensor${c.Monitor}`][c.Chemical].length !== 1)
                        console.log(++count,curTime, `sensor${c.Monitor}`, c.Chemical, chemical[curTime][`sensor${c.Monitor}`][c.Chemical], c.Reading);
                }
                console.log("Done",count);
                console.log(min,max);
            });
    }
    this.loadData = loadData;

    function loadMiddleMap(){
        self.middleMap.init();
        self.middleMap.drawFactories();
        self.middleMap.drawSensors();
    }
    // self.loadMiddleMap = loadMiddleMap;

    function loadOSPs(){
        let osp = new OverviewScatterPlot(d3.select('#osp-container-1'),1);
        osp.init();
        console.log("Loaded OSPs");
    }
};
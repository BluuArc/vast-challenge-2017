
let Challenge2 = function(){
    let self = this;
    self.data = {};
    self.middleMap = new StreamlineGraph();
    self.osp = [];
    self.windModeIndex = 3;
    let windModes = ['last', 'next','closest', 'interpolate'];
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

            //populate interpolation dropdown
            d3.select('#interpolation-mode').html(`Interpolation Mode: ${windModes[0]}<span class="caret"></span>`).attr('value',0);
            let interpolation_dropdown = d3.select('#interpolation-mode-options');
            for(let w = 0; w < windModes.length; ++w)
                interpolation_dropdown.append('li').append('a')
                    .attr('href','#').html(`${windModes[w]}`)
                    .on('click',function(){
                        d3.select('#interpolation-mode').attr('value', w).html(`Interpolation Mode: ${windModes[w]}<span class="caret"></span>`);
                    });
                // interpolation_dropdown.append('option')
                // .text(w);
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

    //from a wind entry, get the wind vector
    function getWindVector(speed, angle) {
        function convertMetersPerSecToMilesPerHour(metersPerSec) {
            // 1m/s= 2.236936mph
            return metersPerSec * 2.236936;
        }

        //convert the cardinal angle of the wind data to an angle relative to the x axis
        function getAngleRelativeToX(degrees) {
            return 360 - degrees + 90;
        }

        //based off of https://stackoverflow.com/questions/9705123/how-can-i-get-sin-cos-and-tan-to-use-degrees-instead-of-radians
        function toRadians(angle) {
            return angle * (Math.PI / 180);
        }
        //based off of https://www.mathsisfun.com/polar-cartesian-coordinates.html
        function convertPolarToCartesian(magnitude, degrees) {
            let x = Math.cos(toRadians(degrees)) * magnitude;
            let y = Math.sin(toRadians(degrees)) * magnitude;
            return {
                x: x,
                y: y
            };
        }

        let mph = convertMetersPerSecToMilesPerHour(speed);
        let vectorAngle = getAngleRelativeToX(angle);
        let coords = convertPolarToCartesian(mph, vectorAngle);
        return new Vector(coords.x, coords.y);
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

                    let windEntry = {
                        speed: speed,
                        direction: parseFloat(w["Wind Direction"]),
                    };

                    if(!isNaN(windEntry.speed) && !isNaN(windEntry.direction)){
                        windEntry.vector = getWindVector(windEntry.speed,windEntry.direction);
                    }
                    timeEntry.push(windEntry);
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


    function convertDateToTimeStamp(date){
        return `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear() % 1000} ${date.getHours()}:00`;
    }

    function getPreviousWindData(timeStamp, options){
        options = options || {};
        let curDate = new Date(timeStamp);
        let data;
        let attempts = 0, maxAttempts = options.maxAttempts || 6;
        while (!data && attempts < maxAttempts) {
            curDate.setHours(curDate.getHours() - 1);
            console.log("Checking",convertDateToTimeStamp(curDate));
            if (self.data.wind[convertDateToTimeStamp(curDate)]) {
                data = self.data.wind[convertDateToTimeStamp(curDate)];
            } else {
                attempts++;
            }
        }
        return {
            data: data,
            time: curDate
        };
    }

    function getNextWindData(timeStamp, options) {
        options = options || {};
        let curDate = new Date(timeStamp);
        let data;
        let attempts = 0, maxAttempts = options.maxAttempts || 6;
        while (!data && attempts < maxAttempts) {
            curDate.setHours(curDate.getHours() + 1);
            if (self.data.wind[convertDateToTimeStamp(curDate)]) {
                data = self.data.wind[convertDateToTimeStamp(curDate)];
                if(isNaN(data[0].speed) || isNaN(data[0].direction)){
                    data = undefined;
                }
            } else {
                attempts++;
            }
        }
        return {
            data: data,
            time: curDate
        };
    }

    function getWindDataAtTimeStamp(time){
        console.log("Requesting wind for",time);
        if (self.data.wind[time]){
            return self.data.wind[time];
        }else{
            console.log("wind mode is",windModes[self.windModeIndex]);
            let attempts = 0, maxAttempts = 6;
            let data;
            let curDate = new Date(time);
            if(windModes[self.windModeIndex] === 'last'){ //get the previous timeStamp
                data = getPreviousWindData(curDate).data;
            } else if (windModes[self.windModeIndex] === 'next') {
                data = getNextWindData(curDate).data;
            } else if (windModes[self.windModeIndex] === 'closest') { //get the next closest time stamp
                let prev = getPreviousWindData(time);
                let next = getNextWindData(time);

                let distFromPrev = curDate - new Date(prev.time);
                let distFromNext = new Date(next.time) - curDate;
                if(distFromPrev < distFromNext){
                    data = prev.data;
                }else{
                    data = next.data;
                }
            } else if(windModes[self.windModeIndex] === 'interpolate'){
                let prev = getPreviousWindData(time);
                let next = getNextWindData(time);

                //interpolate if both times exist
                if(prev && next && prev.data && next.data){
                    console.log("prev",prev);
                    console.log('next',next);
                    let timeRange = new Date(next.time) - new Date(prev.time);
                    let diff = curDate - new Date(prev.time);

                    let speedScale = d3.scaleLinear()
                        .domain([0,timeRange])
                        .range([prev.data[0].speed,next.data[0].speed]);

                    let angleScale = d3.scaleLinear()
                        .domain([0,timeRange])
                        .range([prev.data[0].direction,next.data[0].direction]);

                    data = {
                        speed: speedScale(diff),
                        direction: angleScale(diff)
                    };

                    if (!isNaN(data.speed) && !isNaN(data.direction)) {
                        data.vector = getWindVector(data.speed, data.direction);
                    }
                    data = [data]; //convert object into an array
                }else if(prev && prev.data){
                    data = prev.data;
                }else if(next && next.data){
                    data = next.data;
                }

            }

            return data;
        }
    }

    // self.loadMiddleMap = loadMiddleMap;
    function getDataAtTimeStamp(time){
        let chemical = self.data.chemical[time];
        let wind = getWindDataAtTimeStamp(time);

        return {
            chemical: chemical,
            wind: wind
        };
    }

    function updateMiddleMap(sensorObject, difference){
        if(typeof sensorObject === "string"){
            sensorObject = getDataAtTimeStamp(sensorObject);
        }
        self.middleMap.update(sensorObject,difference);
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

    self.startSimulation = function(index){
        self.windModeIndex = index;
        console.log("Interpolation mode", windModes[index]);
        self.middleMap.setSimulationMode(true);
    }

    self.stopSimulation = function(){
        self.middleMap.setSimulationMode(false);
    }
};
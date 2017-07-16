
let Challenge2 = function(options){
    options = options || {};
    let self = this;
    self.data = {};
    self.osp = [];
    self.windModeIndex = 0;
    let verbose = options.verbose || false;
    let isSimulating = false;
    let windModes = ['last', 'next','closest', 'interpolate'];
    function loadCSV(filename){
        return new Promise(function(fulfill,reject){
            d3.csv(filename,function(data){
                if(verbose) console.log(data);
                fulfill(data);
            });
        });
    }

    let jumpToTimeStamp = options.jumpToTimeStamp;

    function init(){
        options.sensorClickHandler = (sensorName) => {
            self.updateTimeSlider(undefined, sensorName, undefined);
            self.updateOverviewCharts(undefined,undefined,sensorName,undefined);
        }
        options.chemicalClickHandler = (chemicalName,sensorName) => {
            self.updateTimeSlider(undefined,sensorName,chemicalName);
            self.updateOverviewCharts(undefined, undefined, sensorName, undefined);
        }
        return loadData().then(function(){
            if(options.timestamps){
                let local_timestamps = getChemicalTimeStamps();
                for(let t of local_timestamps){
                    options.timestamps.push(t);
                }
            }
            self.streamLineMap = new StreamlineGraph(options);
            self.timeSlider = new TimeSlider(options);
            self.overviewChart = new ChemicalOverviewChart(options);
            loadStreamlineMap();
            loadOverviewMap();
            loadBrushSlider();
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

    function createEmptyDelta(){
        let sensors = {};
        let chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
        for (let i = 1; i <= 9; ++i) {
            sensors[`sensor${i}`] = {};
            let curSensor = sensors[`sensor${i}`];
            for (let c of chemical_names) {
                curSensor[c] = NaN;
            }
        }
        return sensors;
    }

    //from a wind entry, get the wind vector
    function getWindVector(speed, angle) {
        function convertMetersPerSecToMilesPerHour(metersPerSec) {
            // 1m/s= 2.236936mph
            return metersPerSec * 2.236936;
        }

        //convert the cardinal angle of the wind data to an angle relative to the x axis
        function getAngleRelativeToX(degrees) {
            return 360 - degrees + 90+180;
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

    //populate the db object with date entries by the given hour_step
    function generateMonthEntries(db,month_num, year_num,hour_step,newEntryFn){
        let curDate = new Date(`${month_num}/1/${year_num} 0:00`);
        while(curDate.getMonth()+1 === month_num){
            if(typeof newEntryFn === "function"){
                db[convertDateToTimeStamp(curDate)] = newEntryFn();
            }else{
                db[convertDateToTimeStamp(curDate)] = { empty: true };
            }
            curDate.setHours(curDate.getHours()+(hour_step || 1));
        }
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
            },
            delta: {
                Appluimonia: {
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
                let curMonth, curYear;
                for(let w of data.wind){
                    if (w.Date.length === 0 && w["Wind Speed (m/s)"].length === 0 && w["Wind Direction"].length === 0){
                        ignored_count++;
                        continue;
                    }

                    if (w.Date.length === 0 || w["Wind Speed (m/s)"].length === 0 || w["Wind Direction"].length === 0){
                        if(verbose) console.log("Wind entry may be invalid",w);
                    }

                    curDate = new Date(w.Date);

                    if(!wind[`${curDate.getMonth()+1}/1/${curDate.getFullYear()%1000} 0:00`]){
                        // if(verbose) console.log("Generating entries for",curDate);
                        generateMonthEntries(wind,curDate.getMonth()+1,curDate.getFullYear()%1000,3,() => {return [];});
                    }
                    let timeEntry = wind[w.Date];
                    if(!timeEntry){
                        if(verbose) console.log("Error: Time entry",curDate,"doesn't exist");
                    }


                    let statEntry = statistics.wind;
                    let speed = parseFloat(w["Wind Speed (m/s)"]);
                    if (!isNaN(speed)){
                        statEntry.max = (speed > statEntry.max) ? speed : statEntry.max;
                        statEntry.min = (speed < statEntry.min) ? speed : statEntry.min;
                        statEntry.amount++;
                    }else{
                        if(verbose) console.log("Possibly erronous wind value", w);
                    }

                    let windEntry = {
                        speed: speed,
                        direction: parseFloat(w["Wind Direction"]),
                    };

                    if(!isNaN(windEntry.speed) && !isNaN(windEntry.direction)){
                        windEntry.vector = getWindVector(windEntry.speed,windEntry.direction);
                    }
                    timeEntry.push(windEntry);
                }
                if(verbose) console.log("Ignored",ignored_count,"empty wind entries");
                let wind_error = [];
                for(let w in wind){
                    if(wind[w].length !== 1){
                        wind_error.push({
                            time: w,
                            data: wind[w],
                            length: wind[w].length
                        });
                    }
                }
                if(wind_error.length > 0){
                    if(verbose) console.log("Potentially erronous wind entries",wind_error);
                }

                let chemical = {};
                let delta = {};
                let erroneous = [];
                let prevTimeEntry;
                for(let c of data.chemical){

                    curDate = new Date(c["Date Time "]);

                    if (!chemical[`${curDate.getMonth() + 1}/1/${curDate.getFullYear() % 1000} 0:00`]) {
                        // if(verbose) console.log("Generating chemical entries for", curDate);
                        generateMonthEntries(chemical, curDate.getMonth() + 1, curDate.getFullYear() % 1000, 1, createSensors);
                        generateMonthEntries(delta, curDate.getMonth() + 1, curDate.getFullYear() % 1000, 1, createEmptyDelta);
                        // if(verbose) console.log(chemical);
                    }
                    let timeEntry = chemical[c["Date Time "]];
                    let deltaEntry = delta[c["Date Time "]];
                    if (!timeEntry) {
                        if(verbose) console.log("Error: Time entry", curDate, "doesn't exist");
                    }

                    let value = parseFloat(c.Reading);
                    timeEntry[`sensor${c.Monitor}`][c.Chemical].push(value);
                }

                //generate delta entries and chemical statistic entries
                for(let c in chemical){
                    let curDate = new Date(c);
                    if (!delta[`${curDate.getMonth() + 1}/1/${curDate.getFullYear() % 1000} 0:00`]) {
                        // if(verbose) console.log("Generating delta entries for", curDate);
                        generateMonthEntries(delta, curDate.getMonth() + 1, curDate.getFullYear() % 1000, 1, createEmptyDelta);
                        // if(verbose) console.log(chemical);
                    }

                    let timeEntry = delta[c];
                    if(!timeEntry){
                        if (verbose) console.log("Error: Time entry", curDate, "doesn't exist");
                    }

                    calculateDelta(prevTimeEntry,chemical[c],timeEntry, statistics.delta);

                    for(let s in chemical[c]){
                        for(let chem in chemical[c][s]){
                            if(chemical[c][s][chem].length === 1){
                                let statEntry = statistics.chemical[chem];
                                let value = parseFloat(chemical[c][s][chem][0]);
                                if (!isNaN(value)) {
                                    if(value > statEntry.max){
                                        statEntry.max = value;
                                        statEntry.maxTimeStamp = c;
                                    }

                                    if(value < statEntry.min){
                                        statEntry.min = value;
                                        statEntry.minTimeStamp = c;
                                    }
                                    // statEntry.max = (value > statEntry.max) ? value : statEntry.max;
                                    // statEntry.min = (value < statEntry.min) ? value : statEntry.min;
                                    statEntry.amount++;
                                } else {
                                    if (verbose) console.log("Possibly erroneous chemical value", c);
                                }
                            }
                        }
                    }

                    prevTimeEntry = chemical[c];
                }

                (function(chemical_db,erroneous_acc){
                    let chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
                    for(let c in chemical_db){
                        let sensors = chemical_db[c];
                        for (let i = 1; i <= 9; ++i) {
                            let curSensor = sensors[`sensor${i}`];
                            for (let cn of chemical_names) {
                                if(curSensor[cn].length !== 1){
                                    erroneous_acc.push({
                                        time: c,
                                        sensor: i,
                                        chemica: cn,
                                        data: curSensor[cn],
                                        length: curSensor[cn].length
                                    });
                                }
                            }
                        }
                    }
                })(chemical,erroneous);
                if(erroneous.length > 0)
                    if(verbose) console.log("Potentially Erroneous Chemical Data:\n",erroneous);


                self.data = {
                    wind: wind,
                    chemical: chemical,
                    delta: delta
                };

                //create linear scales for each statistic
                for(let chem in statistics.chemical){
                    let curStat = statistics.chemical[chem];
                    curStat.scale = d3.scaleLinear().domain([(curStat.min < 0) ? curStat.min : 0, curStat.max]);
                }

                for(let chem in statistics.delta){
                    let curStat = statistics.delta[chem];
                    curStat.scale = d3.scaleLinear().domain([(curStat.min < 0) ? curStat.min : 0, curStat.max]);
                }

                statistics.wind.scale = d3.scaleLinear().domain([statistics.wind.max,statistics.wind.max]);

                self.data.wind._statistics = statistics.wind;
                self.data.chemical._statistics = statistics.chemical;
                self.data.delta._statistics = statistics.delta;
                return;
            });
    }
    this.loadData = loadData;

    function loadStreamlineMap(){
        let options = {
            scales: {
                Appluimonia: self.data.chemical._statistics.Appluimonia.scale,
                Chlorodinine: self.data.chemical._statistics.Chlorodinine.scale,
                Methylosmolene: self.data.chemical._statistics.Methylosmolene.scale,
                'AGOC-3A': self.data.chemical._statistics['AGOC-3A'].scale,
                wind: self.data.wind._statistics.scale
            },
        };
        self.streamLineMap.init(options);
    }

    function loadBrushSlider(){
        let options = {
            scales: {
                Appluimonia: self.data.delta._statistics.Appluimonia.scale,
                Chlorodinine: self.data.delta._statistics.Chlorodinine.scale,
                Methylosmolene: self.data.delta._statistics.Methylosmolene.scale,
                'AGOC-3A': self.data.delta._statistics['AGOC-3A'].scale,
                wind: self.data.wind._statistics.scale,
                jumpToTimeStamp: jumpToTimeStamp
            }
        };
        self.timeSlider.init(options);
    }

    function loadOverviewMap() {
        let options = {
            scales: {
                Appluimonia: self.data.chemical._statistics.Appluimonia.scale,
                Chlorodinine: self.data.chemical._statistics.Chlorodinine.scale,
                Methylosmolene: self.data.chemical._statistics.Methylosmolene.scale,
                'AGOC-3A': self.data.chemical._statistics['AGOC-3A'].scale,
                wind: self.data.wind._statistics.scale
            },
            statistics: {
                Appluimonia: self.data.chemical._statistics.Appluimonia,
                Chlorodinine: self.data.chemical._statistics.Chlorodinine,
                Methylosmolene: self.data.chemical._statistics.Methylosmolene,
                'AGOC-3A': self.data.chemical._statistics['AGOC-3A'],
                wind: self.data.wind._statistics
            }
        };
        if(verbose) console.log("Started initialization of overview map");
        self.overviewChart.init(options);
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
            if(verbose) console.log("Checking",convertDateToTimeStamp(curDate));
            if (self.data.wind[convertDateToTimeStamp(curDate)]) {
                data = self.data.wind[convertDateToTimeStamp(curDate)];
                if (!data[0] || isNaN(data[0].speed) || isNaN(data[0].direction)) {
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

    function getNextWindData(timeStamp, options) {
        options = options || {};
        let curDate = new Date(timeStamp);
        let data;
        let attempts = 0, maxAttempts = options.maxAttempts || 6;
        while (!data && attempts < maxAttempts) {
            curDate.setHours(curDate.getHours() + 1);
            if (self.data.wind[convertDateToTimeStamp(curDate)]) {
                data = self.data.wind[convertDateToTimeStamp(curDate)];
                if(!data[0] || isNaN(data[0].speed) || isNaN(data[0].direction)){
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

    function updateWindIndicator(msg){
        let wind_indicator = d3.select('#wind-indicator');
        wind_indicator.text(msg);
        if(msg.toLowerCase().indexOf("no wind data found") > -1){
            wind_indicator.classed('error',true);
        }else{
            wind_indicator.classed('error',false);
        }
    }

    function getWindDataAtTimeStamp(time){
        if(verbose) console.log("Requesting wind for",time);
        
        if (self.data.wind[time] && self.data.wind[time].length > 0){
            updateWindIndicator(convertDateToTimeStamp(new Date(time)));
            self.streamLineMap.updateWindGlyph(self.data.wind[time],time, isSimulating);
            return self.data.wind[time];
        }else{
            if(verbose) console.log("No valid entry directly at",time);
            if(verbose) console.log("wind mode is",windModes[self.windModeIndex]);
            let attempts = 0, maxAttempts = 6;
            let data;
            let curDate = new Date(time);
            let result;
            if(windModes[self.windModeIndex] === 'last'){ //get the previous timeStamp
                result = getPreviousWindData(curDate);
                data = result.data;
            } else if (windModes[self.windModeIndex] === 'next') {
                result = getNextWindData(curDate);
                data = result.data;
            } else if (windModes[self.windModeIndex] === 'closest') { //get the next closest time stamp
                let prev = getPreviousWindData(time);
                let next = getNextWindData(time);

                let distFromPrev = curDate - new Date(prev.time);
                let distFromNext = new Date(next.time) - curDate;
                if(distFromPrev < distFromNext){
                    data = prev.data;
                    result = prev;
                }else{
                    data = next.data;
                    result = next;
                }
            } else if(windModes[self.windModeIndex] === 'interpolate'){
                let prev = getPreviousWindData(time);
                let next = getNextWindData(time);

                //interpolate if both times exist
                if (prev && prev.data && prev.data[0] && next && next.data && next.data[0] ){
                    // if(verbose) console.log("prev",prev);
                    // if(verbose) console.log('next',next);
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


                    updateWindIndicator(`${convertDateToTimeStamp(prev.time)} and ${convertDateToTimeStamp(next.time)}`);
                    self.streamLineMap.updateWindGlyph(data, `between ${convertDateToTimeStamp(prev.time)} and ${convertDateToTimeStamp(next.time)}`,isSimulating);
                    result = {};
                }else if(prev && prev.data){
                    data = prev.data;
                    result = prev;
                }else if(next && next.data){
                    data = next.data;
                    result = next;
                }else{
                    updateWindIndicator(`No wind data found at nor near ${time}`);
                }

            }

            if(verbose) console.log("Result",result);
            
            if (windModes[self.windModeIndex] !== 'interpolate'){
                if(data && result){
                    updateWindIndicator(`${ convertDateToTimeStamp(result.time) || "Error"}`);
                }else{
                    updateWindIndicator(`No wind data found at nor near ${time}`);
                }
                self.streamLineMap.updateWindGlyph(data, (data && result) ? convertDateToTimeStamp(result.time) : time, isSimulating);
            }
            

            return data;
        }
    }

    function calculateDelta(prev,current,delta_obj, statistics){
        let chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
        for (let i = 1; i <= 9; ++i) {
            let prevSensor;
            if(prev !== undefined) prevSensor = prev[`sensor${i}`];
            let curSensor = current[`sensor${i}`];
            for (let c of chemical_names) {
                if(!prevSensor){
                    if(verbose) console.log("Getting 0");
                    delta_obj[`sensor${i}`][c] = 0;
                } else if (prevSensor[c].length === 1 && curSensor[c].length === 1){
                    let diff = (+curSensor[c][0]) - (+prevSensor[c][0])
                    delta_obj[`sensor${i}`][c] = diff;
                    if(verbose){
                        // console.log("Calculating diffs");
                        // console.log("prev:", prev, "current:", current, "delta", delta_obj);
                    }

                    //update statistic info
                    let statEntry = statistics[c];
                    if (!isNaN(diff)) {
                        statEntry.max = (diff > statEntry.max) ? diff : statEntry.max;
                        statEntry.min = (diff < statEntry.min) ? diff : statEntry.min;
                        statEntry.amount++;
                    } else {
                        if (verbose) console.log("Possibly erroneous delta value");
                    }
                }
                //entries witth 0 or more than 1 remain NaN
            }
        }
    }

    function getDataAtTimeStamp(time){
        let chemical = self.data.chemical[time];
        let wind = getWindDataAtTimeStamp(time);

        return {
            chemical: chemical,
            wind: wind
        };
    }

    function updateStreamLine(time_stamp, difference,render){
        if(!isSimulating && !render){
            return;
        }
        //don't calculate if not simulating
        let sensorObject = getDataAtTimeStamp(time_stamp);
        if(verbose) console.log("Received request for",time_stamp);
        
        if(isSimulating){
            self.streamLineMap.update(sensorObject,difference,render,time_stamp);
        }else if(render){
            //update chemical readings only
            self.streamLineMap.updateChemicalReadings(sensorObject, difference, render, time_stamp);
        }
    }
    self.updateStreamLine = updateStreamLine;

    function updateTimeSlider(time_stamp,sensor,chemical){
        if(verbose) console.log("Entered updateTimeSlider",time_stamp,sensor,chemical);
        if(time_stamp){
            self.timeSlider.updateTimeStamp(time_stamp);
        }
        if(sensor || chemical){
            self.timeSlider.drawChemicalDelta(chemical,sensor,self.data.delta);
        }
    }
    self.updateTimeSlider = updateTimeSlider;

    function updateOverviewTimeIndicator(time_stamp){
        self.overviewChart.updateTimeSelector(time_stamp);
    }
    self.updateOverviewTimeIndicator = updateOverviewTimeIndicator;

    function updateOverviewCharts(start,end, sensor){
        self.overviewChart.update(start,end,sensor,self.data.chemical);
    }
    self.updateOverviewCharts = updateOverviewCharts;

    function getChemicalTimeStamps(){
        let timestamps = Object.keys(self.data.chemical);
        timestamps = timestamps.filter((d) => {
            return (new Date(d)) != "Invalid Date"; //filter out non-timestamp keys
        });
        return timestamps;
    }
    self.getChemicalTimeStamps = getChemicalTimeStamps;

    self.startSimulation = function(index, time_stamp,diffusionRate){
        self.windModeIndex = index;
        isSimulating = true;
        // getWindDataAtTimeStamp(time_stamp);
        if(verbose) console.log("Interpolation mode", windModes[index]);
        self.streamLineMap.setSimulationMode(true,getDataAtTimeStamp(time_stamp),time_stamp,diffusionRate);
        self.overviewChart.drawSimStart(time_stamp);
        self.timeSlider.drawSimStart(time_stamp);
    }

    self.stopSimulation = function(){
        isSimulating = false;
        // d3.select('#wind-indicator').text("---");
        self.streamLineMap.setSimulationMode(false);
        self.overviewChart.drawSimStart();
        self.timeSlider.drawSimStart();
    }

    self.changeInterpolationMode = function(value,time_stamp){
        self.windModeIndex = value;
        getWindDataAtTimeStamp(time_stamp);
    }
};
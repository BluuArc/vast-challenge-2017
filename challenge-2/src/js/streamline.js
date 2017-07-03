`use strict`;

var tooltip = tooltip || new Tooltip();

let StreamlineGraph = function (options) {
    options = options || {};
    let self = this;
    let w = 300, h = 300;
    let kiviatSize = 25;
    let padding = 25;
    let svg = d3.select('#graph').append('svg').classed('svg-content', true)//.attr('width','100%').attr('height','100%')
        .attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', `xMinYMin meet`);
    // .attr('style', `max-height:100%`);
    let scales = {}, axes = {};
    let sensorGraphs = [];
    let windGlyphs = [];
    let isSimulating = false;
    let verbose = options.verbose || false;

    //based off of https://bl.ocks.org/pstuffa/26363646c478b2028d36e7274cedefa6
    let line = d3.line()
        .x(function (d) { return scales.xMilesToSVG(d.x); }) // set the x values for the line generator
        .y(function (d) { return scales.yMilesToSVG(d.y); }) // set the y values for the line generator 
        .curve(d3.curveCatmullRom); // apply smoothing to the line

    let sensorLocations = [
        { name: '1', location: [62, 21] },
        { name: '2', location: [66, 35] },
        { name: '3', location: [76, 41] },
        { name: '4', location: [88, 45] },
        { name: '5', location: [103, 43] },
        { name: '6', location: [102, 22] },
        { name: '7', location: [89, 3] },
        { name: '8', location: [74, 7] },
        { name: '9', location: [119, 42] },
    ];

    let windVectors = []; //array of wind vectors to add at each index/timestamp
    let diffusionVectors = []; //complement to the windVectors to calculate diffusion path

    self.svg = svg;
    let factories = [
        { name: 'Roadrunner Fitness Electronics', location: [89, 27], shape: 'square'},
        { name: 'Kasios Office Furniture', location: [90, 21], shape: '+'},
        { name: 'Radiance ColourTek', location: [109, 26], shape: 'circle'},
        { name: 'Indigo Sol Boards', location: [120, 22], shape: 'x'},
    ];

    self.setSimulationMode = function(bool){
        if(verbose) console.log("Simulation mode",bool);
        isSimulating = bool;

        //reset windVectors array
        windVectors = [];

        //clear existing paths
        if(!bool){
            for(let f of factories)
                drawSimulationPath([],f.name);
        }
    };

    self.init = function (options) {
        
        scales = options.scales || scales;
        //convert pixel to miles
        scales.miles = d3.scaleLinear()
            .domain([0, 200])
            .range([0, 12]);

        //convert miles to svg pixel
        scales.xMilesToSVG = d3.scaleLinear().domain([scales.miles(50), scales.miles(125)])
            .range([padding, w - padding * 2]);//add padding to not go outside bounds
        scales.xPixelToSVG = (function (value) { //auto convert original pixel to scaled pixel
            return scales.xMilesToSVG(scales.miles(value));
        });

        scales.yMilesToSVG = d3.scaleLinear().domain([scales.miles(0), scales.miles(50)])
            .range([h - padding, padding]); //[h,0] makes it so that smaller numbers are lower; add padding to not go outside bounds
        scales.yPixelToSVG = (function (value) { //auto convert original pixel to scaled pixel
            return scales.yMilesToSVG(scales.miles(value));
        });

        // scales.kiviatSize = {}
        // kiviatSize = d3.min([scales.xPixelToSVG(50), scales.yPixelToSVG(20)])/2;
        // if(verbose) console.log(kiviatSize);
        axes.x = d3.axisBottom(scales.xMilesToSVG);
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(0,' + (h - padding) + ')') //move x-axis to bottom of image
            .call(axes.x);

        axes.y = d3.axisLeft(scales.yMilesToSVG).ticks(6);
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(' + padding + ',0)') //move y-axis right to have readable labels
            .call(axes.y);

        // drawWindGlyphs();
        drawFactories();
        // drawSensors();
    };

    //should only be called once
    function drawFactories() {
        let factorySVG = svg.selectAll('.factory').data(factories);
        let offset = kiviatSize * 0.125;
        factorySVG.exit().remove(); //remove excess

        //create new as necessary
        let newFactories = factorySVG.enter();
        newFactories.each(function (d, i) {
            let curFactory = d3.select(this);
            if (d.shape === 'square') {
                curFactory = curFactory.append('rect')
                    .attr('width', offset).attr('height', offset)
                    .attr('x', function (d) { return scales.xPixelToSVG(d.location[0]) - offset / 2; })
                    .attr('y', function (d) { return scales.yPixelToSVG(d.location[1]) - offset / 2; })
            } else if (d.shape === 'circle') {
                curFactory = curFactory.append('circle')
                    .attr('r', offset / 2).attr('cx', function (d) { return scales.xPixelToSVG(d.location[0]) - offset / 2; })
                    .attr('cy', function (d) { return scales.yPixelToSVG(d.location[1]) - offset / 2; })
            } else { //shape is text character
                curFactory = curFactory.append('text').text(d.shape).attr('font-size', offset * 3)
                    .attr('x', function (d) { return scales.xPixelToSVG(d.location[0]) - offset / 2; })
                    .attr('y', function (d) { return scales.yPixelToSVG(d.location[1]); })
            }

            curFactory.classed('factory', true);
        });
    }

    function drawSensors() {
        if(verbose) console.log("scales before draw sensors", scales);
        let sensors = svg.selectAll('.sensor').data(sensorLocations);
        sensors.exit().remove(); //remove excess

        //create new as necessary
        sensors.enter().each(function (d, i) {
            let curGraph = new Kiviat(svg, {
                x: scales.xPixelToSVG(d.location[0]) - (kiviatSize / 2),
                y: scales.yPixelToSVG(d.location[1]) - (kiviatSize / 2)
            }, d.name, scales, {
                    w: kiviatSize,
                    h: kiviatSize
                });
            curGraph.init();
            curGraph.update();
            sensorGraphs.push(curGraph);
        });
    }

    function updateSensors(readings) {
        for (let sensor in readings) {
            let sensorIndex = +(sensor.split('sensor')[1]) - 1;
            if (isNaN(sensorIndex)) { //not a sensor object
                if(verbose) console.log(sensor, "is not a sensor field; skipping");
                continue;
            } else {
                // if(verbose) console.log("updating sensor",sensorIndex+1,"with",readings[sensor]);
            }
            let curGraph = sensorGraphs[sensorIndex];
            curGraph.update(readings[sensor]);
        }
    }

    //input is the same input as drawSimulationPath
    function drawDiffusionPath(vectors){
        //calculate diffusion path
        let end = vectors.length - 1;
        let ccwPoints

        //draw diffusion path
    }

    function drawSimulationPath(vectors, path_id){
        let points = [];
        while(path_id.indexOf(" ") > -1){
            path_id = path_id.replace(" ","_");
        }
        if(verbose) console.log("Vectors for",path_id,vectors);

        svg.selectAll(`#${path_id}`).remove();;
        svg.append('path')
            .attr('id',`${path_id}`)
            .datum(vectors)
            .classed('chemical-streamline',true)
            .attr('d', line);
    }

    //each simulation point is an array of added values to the original location
    function simulateFactory_old(f,windData,direction){
        if(verbose) console.log('windData',windData);
        let points = f.simulationPoints;
        //update all available points
        if(points.length !== 0){
            // if(verbose) console.log("Adding wind vector",windData.vector,"to",points);
            for(let v = 0; v < points.length; ++v){
                if(direction > 0){
                    points[v] = points[v].add(windData.vector);
                }else if(direction < 0){
                    points[v] = points[v].subtract(windData.vector);
                }
            }
        }
        
        if (direction < 0) //add current position again
            points.pop();
        points.push(new Vector(scales.miles(f.location[0]),scales.miles(f.location[1])));
        // else //remove current position
            // points.pop();

        drawSimulationPath(points,f.name);
    }

    //calculate the CCW diffusion unit vector from vectors a and b
    function calculateDiffusionVector(a,b){

    }

    function simulateFactory(f){
        let points = [];
        //generate points from windVector array by adding the windVectors to the current point
        // use <= to add current factory location to end of array
        for(let v = 0; v <= windVectors.length; ++v){
            let curPoint = new Vector(scales.miles(f.location[0]), scales.miles(f.location[1]));
            // if(verbose) console.log("inital point for",v,curPoint);
            // let vMax = windVectors.length - v;
            for(let p = v; p < windVectors.length; ++p){
                // if(verbose) console.log("adding",windVectors[p])
                curPoint = curPoint.add(windVectors[p]);
            }
            // if(verbose) console.log("final point for", v, curPoint);
            points.push(curPoint);
        }
        if(points.length > 2){
            let end = points.length - 1;
            // calculateDiffusionVector(points[end],points[end-1]);
        }

        // if(verbose) console.log("Points for",f.name,points);

        drawSimulationPath(points, f.name);
        // points.push(new Vector(scales.miles(f.location[0]), scales.miles(f.location[1])));
    }

    //data input is an object with 2 keys: wind and chemical
    //chemical has keys sensor1,sensor2,...,sensor9
    //each sensor object has 4 arrays, each keyed by chemical name
    //wind is an array where each index object has keys direction and speed
    self.update = function (data, difference) {
        if(verbose) console.log("Entered update with", data,difference);
        // updateSensors(data.chemical);

        let windData = data.wind;

        if(isSimulating){
            //add/remove wind vectors as necessary
            if (difference > 0) {
                windVectors.push(windData[0].vector);
            } else if (difference < 0) {
                windVectors.pop();
            }
            if(verbose) console.log("windVectors",windVectors);
            for(let f of factories){
                simulateFactory(f);
            }   
        }
    };

};
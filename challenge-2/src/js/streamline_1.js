`use strict`;

var tooltip = tooltip || new Tooltip();

let StreamlineGraph_1 = function (options) {
    console.log("received options:",options)
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
    let diffusion_rate = 0.05;

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
    // let diffusionVectors = []; //complement to the windVectors to calculate diffusion path

    self.svg = svg;
    let factories = [
        { name: 'Roadrunner Fitness Electronics', location: [89, 27], shape: 'square', diffusionVectors: []},
        { name: 'Kasios Office Furniture', location: [90, 21], shape: '+', diffusionVectors: []},
        { name: 'Radiance ColourTek', location: [109, 26], shape: 'circle', diffusionVectors: []},
        { name: 'Indigo Sol Boards', location: [120, 22], shape: 'x', diffusionVectors: []},
    ];

    function updateWindIndicator(msg) {
        let wind_indicator = d3.select('#wind-indicator');
        wind_indicator.text(msg);
    }

    function plotPointAt(x, y) {
        if (x instanceof Vector) {
            y = x.y;
            x = x.x;
        }
        console.log(x,y);
        return svg.append('circle')
            .attr('r', 5)
            .attr('cx', scales.xMilesToSVG(x))
            .attr('cy', scales.yMilesToSVG(y));
    }

    self.setSimulationMode = function(bool){
        if(verbose) console.log("Simulation mode",bool);
        isSimulating = bool;

        //reset windVectors array
        windVectors = [];

        //clear existing paths
        if(!bool){
            for(let f of factories){
                f.diffusionVectors = [];
                drawSimulationPath([],f.name);
                drawDiffusionPath([],[],f.name);
            }
        }else{
            // for(let f of factories){
            //     calculateFactoryDiffusionVectors(f);
            // }
            calculateFactoryDiffusionVectors(factories[0]);
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

    //calculate the CCW diffusion unit vector from points a, b, and c
    //a is the newest timestamp, and c is the oldest time stamp
    /* Visual representation of points a,b, and c
            c <-- b
                / ^
               /  |
             \/_  |
          bisect  a

    */
    function calculateDiffusionVector(a, b, c) {
        let vectorA, vectorB, unitBisect, doRotate = false;
        console.log("Received", a, b, c);
        if (!b) {
            throw Error("Point B is required");
        } else if (!a && !c) {
            throw Error("Point A or C is required");
        } else {
            if (!a) { //at beginning of path
                console.log("bc");
                vectorB = c.subtract(b); //b -> c
                vectorA = vectorB.multiply(1); //a -> b; extended endpoint
                doRotate = true;
            } else if (!c) { //at end of path
                console.log("ab");
                vectorA = b.subtract(a); //a -> b
                vectorB = vectorA.multiply(1); //b -> c; extended endpoint
                doRotate = true;
            } else { //at middle of path
                console.log("abc");
                vectorA = b.subtract(a); //a -> b
                vectorB = c.subtract(b); //b -> c
            }
        }

        if (doRotate) {
            unitBisect = vectorA.unit().rotateXY(90);
        } else {
            let unitB = vectorB.unit();
            let reverseA = vectorA.multiply(-1);
            let unitReverseA = reverseA.unit();

            // show red reference points
            // let multiplier = 20;
            // plotPointAt(b.add(unitB.multiply(multiplier))).attr('fill','red');
            // plotPointAt(b.add(unitReverseA.multiply(multiplier))).attr('fill','red');

            let fullBisect = unitB.add(unitReverseA);
            unitBisect = fullBisect.unit(); //this is what get's saved
        }

        //keeping one or the other doesn't matter as long as we're consistently picking one side
        let cross = vectorA.cross(unitBisect);
        if (cross.z > 0) {
            return unitBisect;
        } else {
            return unitBisect.multiply(-1);
        }
    }

    function drawDiffusionPath(points, diffusionVectors, path_id) {
        while (path_id.indexOf(" ") > -1) {
            path_id = path_id.replace(" ", "_");
        }
        svg.selectAll(`#${path_id}-diffusion`).remove();
        if(diffusionVectors.length === 0){
            return;
        }
        let path_points = [];
        console.log("Diffusion:", diffusionVectors, "points:", points);
        let end = diffusionVectors.length - 1;
        let multiplier = diffusion_rate * -2;
        //draw half of the path
        for (let f = 0; f < diffusionVectors.length; ++f) {
            path_points.push(points[f].add(diffusionVectors[f].multiply(-multiplier * f)));
        }

        //add middle point
        let radius = diffusion_rate * end;
        let endPoint = ((a, b, c) => {
            //excerpt from calculateDiffusionVector
            let vectorA = b.subtract(a); //a -> b
            let vectorB = vectorA.multiply(-1);
            return vectorA.unit();
        })(points[end - 1], points[end]);
        endPoint = points[end].add(endPoint.multiply(-multiplier * end));
        path_points.push(endPoint);

        for (let f = end; f >= 0; --f) {
            path_points.push(points[f].add(diffusionVectors[f].multiply(multiplier * f)));
        }

        //draw path points
        // for (let p of path_points) {
        //     plotPointAt(p).attr('r', 5).attr('id', `${path_id}-diffusion`).attr('fill','red');
        // }

        // svg.append('path')
        //     // .attr('id',`${path_id}`)
        //     .datum(path_points)
        //     .attr('stroke', 'red')
        //     .attr('fill', 'none')
        //     // .classed('chemical-streamline',true)
        //     // .attr('d', (d) => { return d; });
        //     .attr('d', line)

        svg.append('path')
            .attr('id', `${path_id}-diffusion`)
            .datum(path_points)
            .classed('chemical-streamline', true)
            .attr('d', line)
            .attr('style','stroke:red;');
    }

    //input is the same input as drawSimulationPath
    function drawDiffusionPath_old(vectors,diffusionVectors,path_id){
        while (path_id.indexOf(" ") > -1) {
            path_id = path_id.replace(" ", "_");
        }
        if (verbose) console.log("Diffusion vectors for", path_id, diffusionVectors);
        svg.selectAll(`#${path_id}-diffusion`).remove();
        svg.append('path')
            .attr('id', `${path_id}-diffusion`)
            .datum(diffusionVectors)
            .classed('chemical-streamline', true)
            .attr('d', line);
    }

    function drawSimulationPath(vectors, path_id){
        while(path_id.indexOf(" ") > -1){
            path_id = path_id.replace(" ","_");
        }
        if(verbose) console.log("Vectors for",path_id,vectors);
        let diffusion_path = [];
        svg.selectAll(`#${path_id}`).remove();;
        svg.append('path')
            .attr('id',`${path_id}`)
            .datum(vectors)
            .classed('chemical-streamline',true)
            .each((data) => {
                for(let p = 0; p < data.length; ++p){
                    // plotPointAt(data[p]).attr('id', `${path_id}`).attr('r',5);
                    diffusion_path.unshift(calculateDiffusionVector(data[p-1],data[p],data[p+1]));
                }
            })
            .attr('d', line)
        if (path_id === 'Roadrunner_Fitness_Electronics')
            drawDiffusionPath(vectors.reverse(),diffusion_path.reverse(),path_id);
    }

    function calculateFactoryDiffusionVectors(factory){
        if(windVectors.length === 0){
            return;
        }
        let points = [];
        let startLocation = [scales.miles(factory.location[0]), scales.miles(factory.location[1])];
        //generate points from windVector array by adding the windVectors to the current point
        // use <= to add current factory location to end of array
        for (let v = 0; v <= windVectors.length; ++v) {
            let curPoint = new Vector(startLocation[0], startLocation[1]);
            // if(verbose) console.log("inital point for",v,curPoint);
            // let vMax = windVectors.length - v;
            for (let p = v; p < windVectors.length; ++p) {
                // if(verbose) console.log("adding",windVectors[p])
                curPoint = curPoint.add(windVectors[p]);
            }
            // if(verbose) console.log("final point for", v, curPoint);
            points.push(curPoint);
        }

        let diffusionVectors = factory.diffusionVectors;
        let p;
        //calculate diffusion vectors as necessary
        for(p = 0; p < points.length; ++p){
            if(!diffusionVectors[p]){
                diffusionVectors[p] = calculateDiffusionVector(points[p-1], points[p],points[p+1]);
            }
        }
        //remove any excess
        while(p <= diffusionVectors.length){
            diffusionVectors.pop();
        }
        console.log("After calculations",diffusionVectors);
    }

    function drawFactoryPaths(factory){
        let points = [],p;
        let startLocation = [scales.miles(factory.location[0]), scales.miles(factory.location[1])];
        //generate points from windVector array by adding the windVectors to the current point
        //use <= to add current factory location to end of array
        for(let v = 0; v <= windVectors.length; ++v){
            let curPoint = new Vector(startLocation[0], startLocation[1]);
            // if(verbose) console.log("inital point for",v,curPoint);
            // let vMax = windVectors.length - v;
            for(p = v; p < windVectors.length; ++p){
                // if(verbose) console.log("adding",windVectors[p])
                curPoint = curPoint.add(windVectors[p]);
            }
            // if(verbose) console.log("final point for", v, curPoint);
            points.push(curPoint);
        }
        
        drawSimulationPath(points, factory.name);
        // drawDiffusionPath(points,factory.diffusionVectors,factory.name);
        // points.push(new Vector(scales.miles(f.location[0]), scales.miles(f.location[1])));
    }

    //data input is an object with 2 keys: wind and chemical
    //chemical has keys sensor1,sensor2,...,sensor9
    //each sensor object has 4 arrays, each keyed by chemical name
    //wind is an array where each index object has keys direction and speed
    self.update = function (data, difference,render) {
        if(verbose) console.log("Entered update with", data,difference,render);
        // updateSensors(data.chemical);

        if(!data.wind){
            if(isSimulating && render){
                updateWindIndicator("No wind data found for current time stamp");
            }
            return;
        }

        let windData = data.wind;

        if(isSimulating){
            //calculate vectors as necessary
            if(difference !== 0){
                if (difference > 0) {
                    windVectors.push(windData[0].vector);
                } else if (difference < 0) {
                    windVectors.pop();
                }

                // for(let f of factories){
                //     calculateFactoryDiffusionVectors(f);
                // }
                calculateFactoryDiffusionVectors(factories[0]);
            }

            // if(verbose) console.log("windVectors",windVectors);
            if(render){
                for(let f of factories){
                    drawFactoryPaths(f);
                }   
            }
        }
    };

};
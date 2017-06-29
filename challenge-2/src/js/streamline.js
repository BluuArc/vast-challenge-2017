`use strict`;

var tooltip = tooltip || new Tooltip();

let StreamlineGraph = function () {
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

    //based off of https://bl.ocks.org/pstuffa/26363646c478b2028d36e7274cedefa6
    let line = d3.line()
        .x(function (d) { console.log(d);return scales.xMilesToSVG(d.x); }) // set the x values for the line generator
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
    self.svg = svg;
    let factories = [
        { name: 'Roadrunner Fitness Electronics', location: [89, 27], shape: 'square', isSimulating: false, simulationPoints: [] },
        { name: 'Kasios Office Furniture', location: [90, 21], shape: '+', isSimulating: false, simulationPoints: [] },
        { name: 'Radiance ColourTek', location: [109, 26], shape: 'circle', isSimulating: false, simulationPoints: [] },
        { name: 'Indigo Sol Boards', location: [120, 22], shape: 'x', isSimulating: false, simulationPoints: [] },
    ];
    self.init = function (options) {
        factories[0].isSimulating = true;
        factories[1].isSimulating = true;
        factories[2].isSimulating = true;
        factories[3].isSimulating = true;
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
        // console.log(kiviatSize);
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

    self.startAnimationFactory = function(x,y){

    };

    function drawWindGlyphs() {
        //based off of https://codepen.io/zxhfighter/pen/wWKqqX 
        svg.append('defs').append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 0 12 12')
            .attr('refX', '6')
            .attr('refY', '6')
            .attr('markerWidth', '12')
            .attr('markerHeight', '12')
            .attr('orient', 'auto');
        svg.select('#arrow').append('path')
            .attr('d', 'M2,2 L10,6 L2,10 L6,6 L2,2')
            .classed('wind-glyph', true);

        for (let i = 1; i < 4; ++i) {
            for (let j = 1; j < 4; ++j) {
                let defaultTransform = `translate(${w * 0.25 * i},${h * 0.25 * j}) scale(2)`;
                let curGlpyh = svg.append("line")
                    .attr("x1", 0)
                    .attr("y1", 1)
                    .attr("x2", 0)
                    .attr("y2", 0)
                    .attr("marker-end", "url(#arrow)")
                    .attr('transform', defaultTransform)
                    .classed('wind-glyph', true);
                windGlyphs.push({
                    glyph: curGlpyh,
                    transformation: defaultTransform
                });
            }
        }
    }

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
        console.log("scales before draw sensors", scales);
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
                console.log(sensor, "is not a sensor field; skipping");
                continue;
            } else {
                // console.log("updating sensor",sensorIndex+1,"with",readings[sensor]);
            }
            let curGraph = sensorGraphs[sensorIndex];
            curGraph.update(readings[sensor]);
        }
    }

    function drawSimulationPath(vectors, path_id){
        let points = [];
        while(path_id.indexOf(" ") > -1){
            path_id = path_id.replace(" ","_");
        }
        // for(let v = 0; v < vectors.length; ++v){
        //     let x = scales.xMilesToSVG(vectors[v].x);
        //     let y = scales.yMilesToSVG(vectors[v].y);
        //     if(points.length === 0){
        //         points.push(`M${x},${y}`);
        //     }else{
        //         points.push(`L${x},${y}`);
        //     }
        // }
        console.log("Vectors for",path_id,vectors);

        svg.selectAll(`#${path_id}`).remove();;
        svg.append('path')
            .attr('id',`${path_id}`)
            .datum(vectors)
            .classed('chemical-streamline',true)
            .attr('d', line);
    }

    function simulateFactory(f,windData){
        console.log('windData',windData);
        let points = f.simulationPoints;
        //update all available points
        if(points.length !== 0){
            console.log("Adding wind vector",windData.vector,"to",points);
            for(let v = 0; v < points.length; ++v){
                points[v] = points[v].add(windData.vector);
            }
        }
        //add current position again
        points.push(new Vector(scales.miles(f.location[0]),scales.miles(f.location[1])));

        drawSimulationPath(points,f.name);
    }

    //data input is an object with 2 keys: wind and chemical
    //chemical has keys sensor1,sensor2,...,sensor9
    //each sensor object has 4 arrays, each keyed by chemical name
    //wind is an array where each index object has keys direction and speed
    self.update = function (data) {
        console.log("Entered update with", data);
        // updateSensors(data.chemical);

        let windData = data.wind;

        for(let f of factories){
            if(f.isSimulating){
                simulateFactory(f, windData[0]);
            }
        }


    };

};
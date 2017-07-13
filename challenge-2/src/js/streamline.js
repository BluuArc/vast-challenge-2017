`use strict`;

var tooltip = tooltip || new Tooltip();

//based off of http://bl.ocks.org/eesur/4e0a69d57d3bfc8a82c2
d3.selection.prototype.moveToFront = function () {
    return this.each(function () {
        this.parentNode.appendChild(this);
    });
};
d3.selection.prototype.moveToBack = function () {
    return this.each(function () {
        var firstChild = this.parentNode.firstChild;
        if (firstChild) {
            this.parentNode.insertBefore(this, firstChild);
        }
    });
};

let StreamlineGraph = function (options) {
    options = options || {};
    let verbose = options.verbose || false;
    if(verbose) console.log("received options:", options);
    let self = this;
    let w = 400, h = 400;
    let padding = 30;
    let glyphSize = 40; //size of things on the map
    let svg = d3.select('#streamline-graph').append('svg').classed('svg-content', true)
        .attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', `xMinYMin meet`);
    let scales = {};
    let windGlyphs = [];
    let windGlyph,legend;
    let isSimulating = false;
    let windVectors = [], timeStamps = [];
    let diffusion_rate = 0.005;
    let sensorClickHandler = options.sensorClickHandler || ((sensorName) => {
        console.log("clicked",sensorName);
    });
    let chemicalClickHandler = options.chemicalClickHandler || ((chemicalName,sensorName) => {
        console.log(`clicked on ${chemicalName} of`, sensorName);
    });

    let line = d3.line()
        .x((d) => { return d.x; }).y((d) => {return d.y; })
        .curve(d3.curveCatmullRom);

    let sensors = [
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

    let factories = [
        { name: 'Roadrunner Fitness Electronics', id: 'Roadrunner-Fitness-Electronics', location: [89, 27], shape: 'square', },
        { name: 'Kasios Office Furniture', id: 'Kasios-Office-Furniture', location: [90, 21], shape: '+', },
        { name: 'Radiance ColourTek', id: 'Radiance-ColourTek', location: [109, 26], shape: 'circle', },
        { name: 'Indigo Sol Boards', id: 'Indigo-Sol-Boards', location: [120, 22], shape: 'x', },
    ];

    function drawPointAt(x,y){
        if (x instanceof Vector) {
            y = x.y;
            x = x.x;
        }

        return svg.append('circle')
            .attr('r', 5)
            .attr('cx', x)
            .attr('cy', y);
    }

    //pixel refers to original 200x200 coordinates or zoomed in coordinates while SVG refers to SVG coordinates
    self.init = function(options){
        scales = options.scales || scales;

        let svgRange = {
            x: [padding, w - padding * 2],
            y: [h - padding, padding]
        };
        //relative to bottom left
        let xPixelRange = [50,125];
        let yPixelRange = [60,-15];
        let maxRange = Math.max(w,h);
        let range = [padding, maxRange-padding];

        scales.PixelToMiles = d3.scaleLinear()
            .domain([0,200]).range([0,12]); //200x200 pixel map -> 12x12 mile map

        scales.xPixelToSVG = d3.scaleLinear().domain(xPixelRange).range(range);
        scales.yPixelToSVG = d3.scaleLinear().domain(yPixelRange).range(range);

        scales.MilesToSVG = d3.scaleLinear().domain([0,scales.PixelToMiles(75)]).range([0,maxRange]);
        scales.xMilesToSVG = d3.scaleLinear().domain([scales.PixelToMiles(xPixelRange[0]),scales.PixelToMiles(xPixelRange[1])]).range(range);
        scales.yMilesToSVG = d3.scaleLinear().domain([scales.PixelToMiles(yPixelRange[0]), scales.PixelToMiles(yPixelRange[1])]).range(range);
        // console.log(scales.MilesToSVG(0), scales.xMilesToSVG(0), scales.yMilesToSVG(0));
        // console.log(scales.MilesToSVG(12),scales.xMilesToSVG(12),scales.yMilesToSVG(12));
        //use miles to SVG scales to get correct tick labels
        let axes = {
            x: d3.axisBottom(scales.xMilesToSVG),
            y: d3.axisLeft(scales.yMilesToSVG).ticks(8)
        };

        //draw axes and glyphs
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(0,' + (h - padding) + ')') //move x-axis to bottom of image
            .call(axes.x);

        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(' + padding + ',0)') //move y-axis right to have readable labels
            .call(axes.y);

        svg.append('text').classed('axis-label',true)
            .attr('text-anchor','middle').attr('transform',`translate(${w/2},${h*0.99})`)
            .text('Relative Map Coordinates in X Direction (Miles)');

        svg.append('text').classed('axis-label', true)
            .attr('text-anchor', 'middle').attr('transform', `translate(${padding*0.25},${h/2}) rotate(-90)`)
            .text('Relative Map Coordinates in Y Direction (Miles)');


        svg.append('text').classed('graph-title',true)
            .attr('text-anchor','middle')
            .attr('x',w/2).attr('y',padding)
            .text("Streamline Map")
        svg.append('text').attr('id','streamline-notification')
            .attr('text-anchor','middle').style('display','none')
            .attr('x',w/2).attr('y',padding*2)
            .text("Simulation Error");
        drawFactories();
        drawSensors();
        drawWindGlyph();

        legend = new StreamlineLegend(svg,new Vector(250,245),{
            factoryConstructor: (parent) => {
                let curFactory = parent.append('circle').classed('factory', true)
                    .attr('r', (glyphSize*0.25) / 2).attr('style', 'fill:lightgray; stroke-width:3px;');
                tooltip.setEvents(curFactory, `<b>Factory Name Shows Up Here</b>`);
                return curFactory;
            },
            windGlyphConstructor: (parent) => {
                let curGlpyh = parent.append("line")
                    .attr("x1", 0)
                    .attr("y1", 1)
                    .attr("x2", 0)
                    .attr("y2", 0)
                    .attr("marker-end", "url(#arrow)")
                    // .attr('transform', defaultTransform)
                    .classed('wind-glyph', true)
                return curGlpyh;
            },
            pixelSensorConstructor: (parent, location,size) => {
                let curSensor = new PixelSensor(parent, location, "", {
                    scales: scales,
                    quadrantSize: size,
                    sensorClickHandler: sensorClickHandler,
                    chemicalClickHandler: chemicalClickHandler
                });
                return curSensor;
            }
        });
        legend.init();
    };

    function drawWindGlyph() {
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
        

        //add NSWE labels
        let compassGroup = svg.append('g').style('opacity',0.5);
        let multiplierDistance = 0.04, yMultiplier = 0.114, xMultiplier = 0.15;
        let nonTextOffset = 0.012;
        compassGroup.append('path')
            .datum([new Vector(w*(xMultiplier-multiplierDistance),h*(yMultiplier-nonTextOffset)),new Vector(w*(xMultiplier+multiplierDistance),h*(yMultiplier-nonTextOffset))])
            .attr('d',line);
        compassGroup.append('path')
            .datum([new Vector(w*xMultiplier, h*(yMultiplier - nonTextOffset+multiplierDistance)), new Vector(w*xMultiplier, h*(yMultiplier - nonTextOffset-multiplierDistance))])
            .attr('d', line);
        compassGroup.append('text').text('N').attr('text-anchor','middle')
            .attr('x', w * xMultiplier).attr('y',h * (yMultiplier - multiplierDistance)).style('font-size','small');
        compassGroup.append('text').text('S').attr('text-anchor', 'middle')
            .attr('x', w * xMultiplier).attr('y', h * (yMultiplier + multiplierDistance)).style('font-size', 'small');
        compassGroup.append('text').text('W').attr('text-anchor', 'middle')
            .attr('x', w * (xMultiplier - multiplierDistance)).attr('y', h * yMultiplier).style('font-size', 'small');
        compassGroup.append('text').text('E').attr('text-anchor', 'middle')
            .attr('x', w * (xMultiplier + multiplierDistance)).attr('y', h * yMultiplier).style('font-size', 'small');

        let group = svg.append('g').classed('wind-glyph', true).attr('id', 'main')
            .attr('transform', `translate(${w * 0.15},${h * 0.1})`);
        windGlyph = {
            group: group,
            mouseover: group.append('rect').classed('glyph-mouseover', true)
                .attr('width', 12).attr('height', 12)
                .attr('x', -12 / 2).attr('y', -12 / 2)
                .attr('fill', 'transparent'),
            glyph: group.append('line')
                .attr("x1", 0).attr("y1", 1)
                .attr("x2", 0).attr("y2", 0)
                .attr("marker-end", "url(#arrow)")
                .attr('transform', `scale(2)`)
                .classed('wind-glyph', true).attr('id', 'glyph'),
            transformation: `translate(${w * 0.15},${h * 0.1})`,
        };
        /*
        let group = svg.append('g');

        for (let i = 1; i < 4; ++i) {
            for (let j = 1; j < 4; ++j) {
                let defaultTransform = `translate(${w * 0.25 * i},${h * 0.25 * j}) scale(2)`;
                let curGlpyh = group.append("line")
                    .attr("x1", 0)
                    .attr("y1", 1)
                    .attr("x2", 0)
                    .attr("y2", 0)
                    .attr("marker-end", "url(#arrow)")
                    .attr('transform', defaultTransform)
                    .classed('wind-glyph', true).classed('hide',true);
                windGlyphs.push({
                    glyph: curGlpyh,
                    transformation: defaultTransform
                });
            }
        }
        */
    }

    function drawFactories(){
        let factorySVG = svg.selectAll('.factory').data(factories);
        factorySVG.exit().remove();

        let offset = glyphSize * 0.25;
        let newFactories = factorySVG.enter();
        newFactories.each(function (d, i) {
            let curFactory = d3.select(this);
            let location = {
                x: scales.xPixelToSVG(d.location[0]),// - offset / 2,
                y: scales.yPixelToSVG(d.location[1])// - offset / 2
            };
            curFactory = curFactory.append('circle').classed('factory',true)
                .attr('r', offset / 2).classed(`${d.id}`,true)
                .attr('cx', location.x).attr('cy', location.y).attr('style','fill:lightgray; stroke-width:3px;');
            tooltip.setEvents(curFactory, `<b>${d.name}</b>`);
            factories[i].domElement = curFactory;
        });
    }

    function drawSensors(){
        let sensorsSVG = svg.selectAll('.sensor').data(sensors);
        sensorsSVG.exit().remove();

        let offset = glyphSize;
        let newSensors = sensorsSVG.enter();
        newSensors.each(function(d,i){
            let curSensor = d3.select(this);
            let location = {
                x: scales.xPixelToSVG(d.location[0]) - offset / 2,
                y: scales.yPixelToSVG(d.location[1]) - offset / 2
            };
            sensors[i].object = new PixelSensor(curSensor,location,d.name,{
                scales: scales,
                quadrantSize: glyphSize/2,
                sensorClickHandler: sensorClickHandler,
                chemicalClickHandler: chemicalClickHandler,
                verbose: verbose
            });

            sensors[i].object.init();
        });
    }

    //reset variables as necessary
    self.setSimulationMode = function(bool,data,time_stamp,diffusionRate){
        isSimulating = bool;

        windVectors = [];
        timeStamps = [];

        if(isSimulating){
            if(!isNaN(diffusionRate) && diffusionRate >= 0){
                diffusion_rate = diffusionRate;
            }else{
                alert("Please enter a valid diffusion rate. Using old diffusion_rate value",diffusion_rate);
            }
        }

        // for(let arrow of windGlyphs){
        //     arrow.glyph.classed('hide',bool !== true);
        // }

        if(!bool){
            for(let f of factories){
                drawStreamlinePath(f,[]);
                drawDiffusionPath(f,[]);
            }
        }else{
            // timeStamps.push(time_stamp);
            // self.update(data,1,true,time_stamp);
            for (let f of factories) {
                let path = calculateFactoryPath(f, windVectors);
                if(verbose) console.log("Plotting for", f.name);
                drawDiffusionPath(f, path.diffusion);
                drawStreamlinePath(f, path.streamline);
                drawStreamlinePoints(f, path.streamline,time_stamp);
            }
        }
    };

    self.updateChemicalReadings = function(data){
        //update chemical data
        if (!data.chemical) {
            for (let s of sensors) {
                s.object.update();
            }
        } else {
            let chemicalData = data.chemical;
            for (let s in chemicalData) {
                let index = +(s.split('sensor')[1]) - 1;
                // console.log("Updating sensor", index + 1);
                sensors[index].object.update(chemicalData[s]);
                sensors[index].object.graph.moveToFront();
            }
        }
    }

    //wind is an array where each index object has keys direction and speed
    self.updateWindGlyph = function(wind,time_stamp_msg,isSimulating){
        function convertMetersPerSecToMilesPerHour(metersPerSec) {
            // 1m/s= 2.236936mph
            return metersPerSec * 2.236936;
        }
        if (verbose) console.log("entered updateWindGlyph",arguments);
        if(!wind || wind.length === 0){
            windGlyph.group.selectAll('*').classed('error', true);
            let msg = `No wind data found for ${time_stamp_msg}. `;
            if(isSimulating){
                msg += `No data will be added to simulation calculations.`;
            }
            tooltip.setEvents(windGlyph.group, msg);
        }else{
            let rotationAngle = wind[0].direction;
            if (verbose) console.log("rotation",rotationAngle);
            let msg = "";
            windGlyph.group.attr('transform',`${windGlyph.transformation} rotate(${rotationAngle+180})`)
            windGlyph.group.selectAll('*').classed('error',false).classed('warning',false);
            msg += `<b>Time Stamp:</b> ${time_stamp_msg}`;
            msg += `<br><b>Wind Speed:</b> ${convertMetersPerSecToMilesPerHour(wind[0].speed).toFixed(2)} mph`;
            msg += `<br><b>Wind Direction:</b> ${((rotationAngle+180)%360).toFixed(2)} degrees (0/360 is North)`;
            if (wind.length > 1) {
                windGlyph.group.selectAll('*').classed('warning', true);
                msg += `<br><b>Note:</b> Multiple wind readings found. Using first reading.`;
            }
            tooltip.setEvents(windGlyph.group,msg);
        }
    }

    //data input is an object with 2 keys: wind and chemical
    //chemical has keys sensor1,sensor2,...,sensor9
    //each sensor object has 4 arrays, each keyed by chemical name
    //wind is an array where each index object has keys direction and speed
    self.update = function(data,difference,render, time_stamp){
        if(verbose)console.log("Entered streamline update with",arguments);

        //update wind simulation data first
        let error_text = svg.select('text#streamline-notification');
        if(!data.wind || data.wind.length === 0){
            if(isSimulating && render){
                error_text.text("Simulation Error")
                    .classed('warning',false).classed('error',true)
                    .style('display',null);
                tooltip.setEvents(error_text,`No data will be added to simulation for current time stamp (${time_stamp}) as there is no wind data.`);

                if (verbose) console.log("Calculating path for windVectors", windVectors, timeStamps);
                for (let f of factories) {
                    let path = calculateFactoryPath(f, windVectors);
                    if (verbose) console.log("Plotting for", f.name);
                    drawDiffusionPath(f, path.diffusion);
                    drawStreamlinePath(f, path.streamline);
                    drawStreamlinePoints(f, path.streamline, time_stamp);
                }
                console.log("Done rendering streamline for",time_stamp);
            }
        }else{
            let windData = data.wind;
            
            let rotationAngle = windData[0].direction;
            if (verbose) console.log("Updating wind using data from timestamp",time_stamp);
            // for (let arrow of windGlyphs) {
            //     arrow.glyph.attr('transform', `${arrow.transformation} rotate(${rotationAngle+180})`).classed('hide',false);
            // }
            if (windData.length > 1) {
                d3.select('#wind-indicator').text(`Multiple wind readings found for ${time_stamp}. Using first reading.`);
                if(isSimulating && render){
                    error_text.text("Simulation Warning")
                        .classed('warning', true).classed('error', false)
                        .style('display', null);
                    tooltip.setEvents(error_text, `Multiple wind readings found for ${time_stamp}. Using first reading.`);
                }
            }else{
                error_text.style('display','none');
            }
            if(isSimulating){
                if(difference > 0){
                    let svgVector = new Vector((windData[0].vector.x), (windData[0].vector.y));
                    windVectors.push(svgVector);
                    if (verbose) console.log("Pushing timestamp",time_stamp);
                    timeStamps.push(time_stamp);
                }else if (difference < 0){
                    windVectors.pop();
                    timeStamps.pop();
                }
                if(render){
                    if (verbose) console.log("Calculating path for windVectors",windVectors,timeStamps);
                    for(let f of factories){
                        let path = calculateFactoryPath(f,windVectors);
                        if (verbose) console.log("Plotting for",f.name);
                        console.log(path.streamline.length);
                        drawDiffusionPath(f,path.diffusion);
                        drawStreamlinePath(f,path.streamline);
                        drawStreamlinePoints(f,path.streamline,time_stamp);
                    }
                    console.log("Done rendering streamline for",time_stamp);
                }
            }
        }

        self.updateChemicalReadings(data);
    };

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
        if (verbose) console.log("Received", a, b, c);
        if (!b) {
            throw Error("Point B is required");
        } else if (!a && !c) {
            throw Error("Point A or C is required");
        } else {
            if (!a) { //at beginning of path
                if(verbose) console.log("bc");
                vectorB = c.subtract(b); //b -> c
                vectorA = vectorB.multiply(1); //a -> b; extended endpoint
                doRotate = true;
            } else if (!c) { //at end of path
                if(verbose) console.log("ab");
                vectorA = b.subtract(a); //a -> b
                vectorB = vectorA.multiply(1); //b -> c; extended endpoint
                doRotate = true;
            } else { //at middle of path
                if(verbose) console.log("abc");
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
            // drawPointAt(b.add(unitB.multiply(multiplier))).attr('fill','red');
            // drawPointAt(b.add(unitReverseA.multiply(multiplier))).attr('fill','red');

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

    //points should be in SVG coordinates already
    function calculateDiffusionPath(points){
        function calculateDiffusionVectors(points) {
            let diffusionVectors = [];
            for (let f = 0; f < points.length; ++f) {
                diffusionVectors.push(calculateDiffusionVector(points[f - 1], points[f], points[f + 1]));
            }
            return diffusionVectors;
        }

        let path_points = [];
        if(points.length < 2){
            return [];
        }
        let diffusionVectors = calculateDiffusionVectors(points);

        let end = diffusionVectors.length - 1;
        let multiplier = scales.MilesToSVG(diffusion_rate);
        if (verbose) console.log("DiffusionRate",diffusion_rate,multiplier);
        //draw half of the path
        for (let f = 0; f < diffusionVectors.length; ++f) {
            path_points.push(points[f].add(diffusionVectors[f].multiply(multiplier * f)));
        }

        //add middle point
        let radius = diffusion_rate * end;
        let endPoint = ((a, b, c) => {
            //excerpt from calculateDiffusionVector
            let vectorA = b.subtract(a); //a -> b
            // let vectorB = vectorA.multiply(-1);
            return vectorA.unit();
        })(points[end - 1], points[end]);
        endPoint = points[end].add(endPoint.multiply(multiplier * end));
        path_points.push(endPoint);

        for (let f = end; f >= 0; --f) {
            path_points.push(points[f].add(diffusionVectors[f].multiply(-multiplier * f)));
        }

        return path_points;
    }

    function calculateFactoryPath(factory,vectors) {
        let streamline_points = []//, diffusion_points = [];
        let startLocation = new Vector(scales.PixelToMiles(factory.location[0]), scales.PixelToMiles(factory.location[1]));
        let end = vectors.length;
        for (let v = 0; v < end; ++v) {
            let curPoint = startLocation.multiply(1);
            //add vectors to get correct offset
            for (let p = v; p < end; ++p) {
                curPoint = curPoint.add(vectors[p]);
            }
            streamline_points.push(curPoint);
        }
        streamline_points.push(startLocation.multiply(1));
        streamline_points = streamline_points.map((p) => { return new Vector(scales.xMilesToSVG(p.x), scales.yMilesToSVG(p.y)); });
        diffusion_points = calculateDiffusionPath(streamline_points.reverse());

        return {
            streamline: streamline_points,
            diffusion: diffusion_points
        };
    }

    function drawStreamlinePoints(factory,points,cur_time_stamp){
        for (let p = 0; p < points.length; ++p) {
            // console.log("Drawing point",p);
            let curPoint = drawPointAt(points[p])
                .classed(`${factory.id}`, true)
                .attr('id', `${factory.id}-streamline`)
                .attr('r', 3)
                .attr('style', 'opacity:0.75;')
            tooltip.setEvents(curPoint, `<b class=${factory.id}>${factory.name}</b><br>${timeStamps[points.length-p-1] || cur_time_stamp}`);
        }
    }

    function drawStreamlinePath(factory,points){
        svg.selectAll(`#${factory.id}-streamline`).remove();
        svg.selectAll(`#${factory.id}-streamline-mouseover`).remove();
        svg.append('path').attr('id',`${factory.id}-streamline`).classed(`${factory.id}`,true)
            .datum(points).attr('d',line).attr('style','fill: none; pointer-events:none;');
        let path = svg.append('path').attr('id', `${factory.id}-streamline-mouseover`).classed(`${factory.id}`, true).classed(`diffusion-mouseover`, true)
            .datum(points).attr('d', line);
        tooltip.setEvents(path,`${factory.name}`);
    }

    function drawDiffusionPath(factory,points){
        svg.selectAll(`#${factory.id}-diffusion`).remove();
        svg.append('path').attr('id', `${factory.id}-diffusion`).classed(`${factory.id}`, true)
            .datum(points).attr('d', line).attr('style', 'opacity: 0.5; pointer-events:none; fill:lightgray;')
    }
}

//position is where the center of hte pixelSensor should be
let PixelSensor = function(parent,position,sensorNumber, options){
    options = options || {};
    let self = this;
    let verbose = options.verbose || false;

    let quadrantSize = options.quadrantSize || 20;
    let center = {
        x: quadrantSize,
        y: quadrantSize
    };
    let notificationBubble;
    let scales = options.scales || {};
    let line = d3.line()
        .x(function (d) { return d.x; })
        .y(function (d) { return d.y; });

    //create group on parent
    parent.append('g').classed('pixel-sensor',true).attr('id',`pixel-sensor-${sensorNumber}`)
        .attr('transform',`translate(${position.x},${position.y})`)
        .append('rect').attr('x',0).attr('y',0).attr('width',quadrantSize*2).attr('height',quadrantSize*2)
        .attr('style','fill:white');
    self.graph = d3.select(`#pixel-sensor-${sensorNumber}`);

    let chemicals = {
        'Appluimonia': {
            reading: 0,
            position: [0,0],
            domElement: undefined
        },
        'Chlorodinine': {
            reading: 0,
            position: [quadrantSize,0],
            domElement: undefined
        },
        'Methylosmolene': {
            reading: 0,
            position: [0,quadrantSize],
            domElement: undefined
        },
        'AGOC-3A': {
            reading: 0,
            position: [quadrantSize,quadrantSize],
            domElement: undefined
        },
    };

    function drawSensorLabelOverlay(){
        let axesCoords = {
            vertical: [new Vector(quadrantSize,0),new Vector(quadrantSize,quadrantSize*2)],
            horizontal: [new Vector(0,quadrantSize),new Vector(quadrantSize*2,quadrantSize)]
        };
        //draw axes
        for(let a in axesCoords){
            self.graph.append('path').datum(axesCoords[a])
            .classed('sensor-label-overlay',true).attr('d',line);
        }

        //draw border
        self.graph.append('rect')
            .attr('x', 0).attr('y', 0)
            .attr('width', quadrantSize * 2).attr('height', quadrantSize * 2)
            .classed('sensor-label-overlay',true).attr('style', 'fill:none');

        //draw center piece
        self.graph.append('circle')
            .attr('cx', center.x).attr('cy', center.y)
            .attr('r', quadrantSize * 0.25)
            .classed('sensor-label-overlay',true);
        self.graph.append('text').classed('sensor-label', true)
            .attr('x', center.x).attr('y', center.y+0.5)
            .text(sensorNumber)
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle');
        notificationBubble = self.graph.append('circle').classed('sensor-label-mouseover', true)
            .attr('cx', center.x).attr('cy', center.y)
            .attr('r', quadrantSize * 0.25)
            .on('click',function(){
                options.sensorClickHandler(`sensor${sensorNumber}`);
            });
    }

    function setSensorMouseOver(sensorElement){
        sensorElement.on('mouseenter',function(){
            let element = d3.select(this);
            let chemical = element.attr('id');
            let value = element.attr('value');
            let domain = scales[chemical].domain();
            let content = `<b class="${chemical}">${chemical}</b><br>`
            content += `<b>Reading:</b> ${value} ppm`;
            content += `<br>Click this quadrant to change focus to <b class=${chemical}>${chemical}</b> and <b>sensor${sensorNumber}</b>`;
            // content += `<br><b>Overall Min:</b> ${domain[0]}<br><b>Overall Max:</b> ${domain[1]}`;
            tooltip.setContent(content);
            tooltip.showAt(d3.event.pageX,d3.event.pageY);
        }).on('mouseleave',function(){
            tooltip.hide();
        }).on('click',function(){
            options.chemicalClickHandler(d3.select(this).attr('id'),`sensor${sensorNumber}`);
        });
    }

    self.init = function(){
        let opacityRange = [0.1,1];
        //initialize scale range to be with respect to opacity
        scales.Appluimonia = (scales.Appluimonia || d3.scaleLinear().domain([0, 2])).range(opacityRange);
        scales.Chlorodinine = (scales.Chlorodinine || d3.scaleLinear().domain([0, 2])).range(opacityRange);
        scales.Methylosmolene = (scales.Methylosmolene || d3.scaleLinear().domain([0, 2])).range(opacityRange);
        scales['AGOC-3A'] = (scales['AGOC-3A'] || d3.scaleLinear().domain([0, 2])).range(opacityRange);

        //draw quadrants
        for(let c in chemicals){
            self.graph.append('rect').attr('width',quadrantSize).attr('height',quadrantSize)
                .attr('x',chemicals[c].position[0]).attr('y',chemicals[c].position[1])
                .classed(`${c}`,true).classed('chemical',true).attr('id',`${c}`)
                .on('click',function(){
                });
            chemicals[c].domElement = self.graph.select(`.${c}`);
            setSensorMouseOver(chemicals[c].domElement);
        }

        //put sensor number
        drawSensorLabelOverlay();

        updateReadings();
    }

    function updateReadings(data){
        //sample data set
        data = data || {
            'Appluimonia': [1.25],
            'Chlorodinine': [1.8],
            'Methylosmolene': [],
            'AGOC-3A': [1,5] 
        }

        //store data into chemicals object
        let error_messages = [];
        for(let c in chemicals){
            if(data[c] !== undefined && data[c].length > 0){
                chemicals[c].reading = ((arr) => {
                    switch (arr.length) {
                        case 1: return arr[0];
                        default: return arr;
                    }
                })(data[c]);
            }else{
                chemicals[c].reading = NaN; //default 0 when no data is given
                error_messages.push(`<b class="${c}">${c}</b> has no readings`);
            }
            self.graph.select(`#${c}`).attr('value', JSON.stringify(chemicals[c].reading));

            //don't plot anything if array
            if(chemicals[c].reading instanceof Array){
                error_messages.push(`<b class="${c}">${c}</b> has more than one reading`);
                chemicals[c].reading = NaN;
            }
        }

        //set error message
        if(error_messages.length > 0){
            if(verbose) console.log("Setting error messages");
            tooltip.setEvents(notificationBubble,error_messages.join("<br>"));
            notificationBubble.classed('error',true);
        }else{
            tooltip.setEvents(notificationBubble,"");
            notificationBubble.classed('error',false);
        }

        draw();
    }
    self.update = updateReadings;

    function draw(){
        for(let c in chemicals){
            if(!isNaN(chemicals[c].reading) && chemicals[c].reading !== 0){
                chemicals[c].domElement.attr('style',`opacity: ${scales[c](chemicals[c].reading)}`).classed('no-data',false);
            }else{
                chemicals[c].domElement.attr('style', `opacity: 1`).classed('no-data', true);
            }
        }
    }
}

let StreamlineLegend = function(parent,position,options){
    options = options || {};
    let self = this;
    const chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
    let padding = 25;
    let w = 125, h = 125;

    parent.append('g').classed('streamline-legend',true).attr('transform',`translate(${position.x},${position.y})`)
    .append('rect').attr('x',0).attr('y',0).attr('width',w).attr('height',h);

    self.graph = d3.select('.streamline-legend');

    function drawPointAt(x, y) {
        if (x instanceof Vector) {
            y = x.y;
            x = x.x;
        }

        return self.graph.append('circle')
            .attr('r', 5)
            .attr('cx', x)
            .attr('cy', y);
    }

    self.init = function(){
        // drawPointAt(35,60);

        let container = self.graph;

        container.append('text').text("Legend")
            .attr('x',w/2).attr('y',10).classed('legend-title',true);

        options.factoryConstructor(container).attr('cx',20).attr('cy',25);
        container.append('text').text('Factory Location').classed('legend-label',true)
            .attr('x',35).attr('y',25+3);

        options.windGlyphConstructor(container).attr('transform',`translate(20,45)`).style('opacity',1.0);
        let windGlyphDescription = container.append('text').text('Wind Direction').classed('legend-label',true)
            .attr('x',35).attr('y',45+3);
        tooltip.setEvents(windGlyphDescription,"North is in the upward direction");

        let pixelSensor = options.pixelSensorConstructor(container,{ x: 10, y: 55 }, 10);
        pixelSensor.init();
        pixelSensor.update({
            'Appluimonia': [10],
            'Chlorodinine': [15],
            'Methylosmolene': [100],
            'AGOC-3A': [45] 
        });
        let pixelSensorMouseOver = container.append('rect')
            .attr('x',10).attr('y',55)
            .attr('width',(10)*2).attr('height',(10)*2)
            .classed('legend-mouseover',true);
        tooltip.setEvents(pixelSensorMouseOver,'Each quadrant represents a chemical and the opacity of each quadrant represents a chemical reading.<br><br>A lighter color represents a lower reading and a more vivid color represents a higher reading.');
        let pixelSensorDescription = container.append('text').text("Sensor Location").classed('legend-label',true)
            .attr('x',35).attr('y',65+3);
        tooltip.setEvents(pixelSensorDescription,`The center of each sensor is the location of the sensor on the map`);

        let chemicalGroup = container.append('g').attr('transform','translate(10,85)');
        let bucketWidth = 1, bucketHeight = 5, numBuckets = 20;
        let opacityScale = d3.scaleLinear().domain([0,numBuckets]).range([0.1,1.0]);
        chemicalGroup.append('rect').attr('x',0).attr('y',0)
            .attr('width',bucketWidth*(numBuckets-1)).attr('height',bucketHeight*chemical_names.length)
            .attr('fill','white').attr('style','stroke: none');
        for(let c of chemical_names){
            let index = chemical_names.indexOf(c);
            let n = 0;
            let zero_reading = chemicalGroup.append('rect')
                .attr('x', n * bucketWidth).attr('y', bucketHeight * index)
                .attr('width', bucketWidth).attr('height', bucketHeight)
                .classed('no-data', true)//.attr('style','stroke: none');
            for(n = 1; n < numBuckets; ++n){
                chemicalGroup.append('rect')
                    .attr('x', n*bucketWidth).attr('y',bucketHeight*index)
                    .attr('width',bucketWidth).attr('height',bucketHeight)
                    .classed(c,true).attr('style',`opacity: ${opacityScale(n)};`);
            }
            let chemical_mouseover = chemicalGroup.append('rect')
                .attr('x',0).attr('y',bucketHeight*index)
                .attr('width',bucketWidth*numBuckets).attr('height',bucketHeight)
                .classed('legend-mouseover',true);
            tooltip.setEvents(chemical_mouseover, `Color range for <b class=${c}>${c}</b> for reading from min (leftmost non-gray color) to max (right).<br><br>The dark gray on the left is shown when there's a 0 or erroneous reading for <b class=${c}>${c}</b>.`);

            // tooltip.setEvents(zero_reading,`This gray is the color shown when there's a 0 or erroneous reading for <b class=${c}>${c}</b>.`);
        }
        container.append('text').text("Chemical Reading").classed('legend-label',true)
            .attr('x',35).attr('y',90+3)
        container.append('text').text("Color Ranges").classed('legend-label', true)
            .attr('x', 35).attr('y', 90+3).attr('dy','1em');
        

        
    }
}

`use strict`;

var tooltip = tooltip || new Tooltip();

let Graph = function(){
    let self = this;
    let min = d3.min([d3.select('#graph').node().offsetWidth, d3.select('#graph').node().offsetHeight]);
    let w = 200, h = 200;
    let kiviatSize = 25;
    let padding = 25;
    let svg = d3.select('#graph').append('svg').classed('svg-content',true)//.attr('width','100%').attr('height','100%')
        .attr('viewBox',`0 0 ${w} ${h}`).attr('preserveAspectRatio', `xMinYMin meet`);
        // .attr('style', `max-height:100%`);
    let scales = {}, axes = {};
    let sensorGraphs  = [];
    let sensorLocations = [
        {name: '1', location: [62, 21]},
        {name: '2', location: [66, 35]},
        {name: '3', location: [76, 41]},
        {name: '4', location: [88, 45]},
        {name: '5', location: [103, 43]},
        {name: '6', location: [102, 22]},
        {name: '7', location: [89, 3]},
        {name: '8', location: [74, 7]},
        {name: '9', location: [119, 42]},
    ];
    self.svg = svg;
    let factoryLocations = [
        { name:'Roadrunner Fitness Electronics', location: [89,27], shape: 'square'},
        { name:'Kasios Office Furniture', location: [90,21], shape: '+'},
        { name:'Radiance ColourTek', location: [109,26], shape: 'circle'},
        { name:'Indigo Sol Boards', location: [120,22], shape: 'x'}
    ];
    self.init = function(options){
        scales = options.scales || scales;
        scales.miles = d3.scaleLinear()
            .domain([0, 200])
            .range([0, 12]);

        let xScale = d3.scaleLinear().domain([scales.miles(50), scales.miles(125)])
            .range([padding, w - padding * 2]);//add padding to not go outside bounds
        scales.x = (function(value){ //auto convert original pixel to scaled pixel
            return xScale(scales.miles(value));
        }); 

        let yScale = d3.scaleLinear().domain([scales.miles(0), scales.miles(50)])
            .range([h - padding, padding]); //[h,0] makes it so that smaller numbers are lower; add padding to not go outside bounds
        scales.y = (function (value) { //auto convert original pixel to scaled pixel
            return yScale(scales.miles(value));
        });

        let borderWidth = xScale.range()[1] - xScale.range()[0];
        let borderHeight = yScale.range()[0] - yScale.range()[1];
        // svg.append('rect').classed('graph-border',true)
        //     .attr('x',padding).attr('y',padding)
        //     .attr('width',(borderWidth > 0) ? borderWidth : (borderWidth*-1))
        //     .attr('height',(borderHeight > 0) ? borderHeight : (borderHeight*-1));

        // scales.kiviatSize = {}
        // kiviatSize = d3.min([scales.x(50), scales.y(20)])/2;
        // console.log(kiviatSize);
        axes.x = d3.axisBottom(xScale);
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(0,' + (h - padding) + ')') //move x-axis to bottom of image
            .call(axes.x);

        axes.y = d3.axisLeft(yScale).ticks(6);
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(' + padding + ',0)') //move y-axis right to have readable labels
            .call(axes.y);

        drawFactories();
        drawSensors();
    };

    //should only be called once
    function drawFactories(){
        let factories = svg.selectAll('.factory').data(factoryLocations);
        let offset = kiviatSize * 0.125;
        factories.exit().remove(); //remove excess

        //create new as necessary
        let newFactories = factories.enter();
        newFactories.each(function(d,i){
                let curFactory = d3.select(this);
                if(d.shape === 'square'){
                    curFactory = curFactory.append('rect')
                        .attr('width', offset).attr('height', offset)
                        .attr('x', function (d) { return scales.x(d.location[0]) - offset / 2; })
                        .attr('y', function (d) { return scales.y(d.location[1]) - offset / 2; })
                }else if(d.shape === 'circle'){
                    curFactory = curFactory.append('circle')
                        .attr('r', offset / 2).attr('cx', function (d) { return scales.x(d.location[0]) - offset / 2; })
                        .attr('cy', function (d) { return scales.y(d.location[1]) - offset / 2; })
                }else{ //shape is text character
                    curFactory = curFactory.append('text').text(d.shape).attr('font-size', offset*3)
                        .attr('x', function (d) { return scales.x(d.location[0])-offset/2; })
                        .attr('y', function (d) { return scales.y(d.location[1]); })
                }

                curFactory.classed('factory', true);
            });
    }

    function drawSensors() {
        console.log("scales before draw sensors",scales);
        let sensors = svg.selectAll('.sensor').data(sensorLocations);
        sensors.exit().remove(); //remove excess

        //create new as necessary
        sensors.enter().each(function(d,i){
            let curGraph = new Kiviat(svg,{
                x: scales.x(d.location[0]) - (kiviatSize/2),
                y: scales.y(d.location[1]) - (kiviatSize/2)
            },d.name, scales,{
                w: kiviatSize,
                h: kiviatSize
            });
            curGraph.init();
            curGraph.update();
            sensorGraphs.push(curGraph);
        });
    }

    //data input is an object with 2 keys: wind and chemical
    //chemical has keys sensor1,sensor2,...,sensor9
    //each sensor object has 4 arrays, each keyed by chemical name
    //wind is an array where each index object has keys direction and speed
    self.update = function(data){
        // console.log("Entered update with",data);
        let readings = data.chemical;
        for(let sensor in readings){
            let sensorIndex = +(sensor.split('sensor')[1])-1;
            if(isNaN(sensorIndex)){ //not a sensor object
                console.log(sensor,"is not a sensor field; skipping");
                continue;
            }else{
                // console.log("updating sensor",sensorIndex+1,"with",readings[sensor]);
            }
            let curGraph = sensorGraphs[sensorIndex];
            curGraph.update(readings[sensor]);
        }
    };

};

let Kiviat = function (parent, position,sensorNumber,scales, options){
    let self = this;
    options = options || {};
    //kiviat dimensions
    //pass in size via parameter, based on pixel distance in image (not svg)?
    let w = options.w || 50, h = options.h || 50;
    let center = {
        x: w/2,
        y: h/2
    };
    let heightOffset = h*0.05;
    let widthOffset = w*0.05;
    let notificationBubble;
    // console.log("w h",w,h);
    //used to draw the lines on the graph
    let lineFunction = d3.line()
        .x(function (d) { return d.x; })
        .y(function (d) { return d.y; });

    //create group on parent
    parent.append('g').classed('kiviat', true).attr('id',`kiviat-sensor-${sensorNumber}`)
        .attr("transform", `translate(${position.x},${position.y}) scale(${options.scale || 1})`);
    self.graph = d3.select(`#kiviat-sensor-${sensorNumber}`);

    scales = scales || {}, axes = {};
    //default point position along each respective axis 
    let pointPositions = {
        'Appluimonia': {position: h/2, value: 0}, //h/2 to 0
        'Chlorodinine': {position: w/2, value: 0}, //w/2 to w
        'Methylosmolene': {position: h/2, value: 0}, //h/2 to h
        'AGOC-3A': {position: w/2, value: 0} //w/2 to 0
    };

    function drawAxes(contentFn){
        let lineData = {
            'Appluimonia': [{x:w/2,y:h/2}, {x:w/2, y:0}], //h/2 to 0
            'Chlorodinine': [{x:w/2,y:h/2}, {x:w, y:h/2}], //w/2 to w
            'Methylosmolene': [{x:w/2,y:h/2}, {x:w/2, y:h}], //h/2 to h
            'AGOC-3A': [{x:w/2,y:h/2}, {x:0, y:h/2}] //w/2 to 0
        };

        for(let chemical in lineData){
            // console.log(chemical,lineData[chemical]);
            axes[chemical] = {}
            axes[chemical].regular = self.graph.append('path')
                    .data([lineData[chemical]])
                    .attr('class', 'axis').attr('id', `${chemical}-axis`)
                    .classed('kiviat-axis',true)
                    .attr('d', lineFunction);
            axes[chemical].helper = self.graph.append('path')
                    .data([lineData[chemical]])
                    .attr('class', 'axis-mouseover').attr('id', `${chemical}-${sensorNumber}-axis-helper`)
                    .attr('d', lineFunction)
                    .attr('value', 0)
                    .on('mouseenter',function(d,i){
                        //default entry values
                        let value = d3.select(this).attr('value');
                        let domain = scales[chemical].domain();
                        let content = `<b class="${chemical}">${chemical}</b><br>${value} ppm`;
                        content += `<br>Overall Min: ${domain[0]}<br>Overall Max: ${domain[1]}`;
                        if(typeof contentFn === "function")
                            content = contentFn(d,i);
                        tooltip.setContent(content);
                        tooltip.showAt(d3.event.pageX, d3.event.pageY);
                    }).on('mouseleave',function(){
                        tooltip.hide();
                        // console.log('left');
                    });
        }
        // console.log("Done setting up listeners");
        
    }

    self.init = function(){        
        //initialize scale range to be with respect to kiviat
        scales.Appluimonia = (scales.Appluimonia || d3.scaleLinear().domain([0, 2])).range([h/2-heightOffset,0]); //top axis;
        scales.Chlorodinine = (scales.Chlorodinine || d3.scaleLinear().domain([0,2])).range([w/2+widthOffset,w]); //right axis
        scales.Methylosmolene = (scales.Methylosmolene || d3.scaleLinear().domain([0,2])).range([h/2+heightOffset,h]); //bottom axis
        scales['AGOC-3A'] = (scales['AGOC-3A'] || d3.scaleLinear().domain([0,2])).range([w/2-widthOffset,0]); //left axis

        //draw axes
        drawAxes();

        //put sensor number
        self.graph.append('text').classed('sensor-label',true)
            .attr('x',w*0.125).attr('y',h*0.125)
            .text(sensorNumber)
            .attr('text-anchor','middle')
            .attr('alignment-baseline', 'middle');
        notificationBubble = self.graph.append('circle').classed('sensor-label-mouseover',true)
            .attr('cx', w*0.125).attr('cy', h*0.0775)
            .attr('r','4px');


        //draw initial point positions
        let points = [];
        for (let c in pointPositions) {
            let translation = get_translation(c, pointPositions[c].position);
            points.push(translation);
        }
        points.push(points[0]);
        self.graph.append('path').data([points])
            .attr('d', lineFunction)
            .classed('current', true)
            .attr('id',`data.${sensorNumber}`);

    };
    
    function notifyError(isError,message){
        console.log("Entered isError for sensor",sensorNumber);
        if(isError){
            notificationBubble.classed('error',true)
                .on('mouseenter', function () {
                    tooltip.setContent(message);
                    tooltip.showAt(d3.event.pageX, d3.event.pageY);
                }).on('mouseleave', function () {
                    tooltip.hide();
                });
        }else{
            notificationBubble.classed('error',false)
                .on('mouseenter',undefined)
                .on('mouseleave',undefined);
        }
    }

    self.update = function(data){
        //sample data set
        data = data || { 
            'Appluimonia': [1.25],
            'Chlorodinine': [1.8],
            'Methylosmolene': [0.75],
            'AGOC-3A': [1] 
        };

        //convert data to object keyed by chemical name
        let convertedData = {};
        for(let d in data){
            convertedData[d] = ((arr) => {
                switch(arr.length){
                    case 0: return 0;
                    case 1: return arr[0];
                    default: return arr;
                }
            })(data[d]);

            d3.select(`#${d}-${sensorNumber}-axis-helper`).attr('value',JSON.stringify(convertedData[d]));
        }

        for (let c in pointPositions){
            if(!convertedData[c]){
                //default to 0 when no data is given
                pointPositions[c] = {
                    position: scales[c](scales[c].domain()[0]),
                    value: 0
                }; 
            }else{
                if(convertedData[c] instanceof Array){
                    console.log("Data is an array", convertedData[c]);
                    notifyError(true, `<b class="${c}">${c}</b> has more than one reading`);
                    pointPositions[c] = {
                        position: scales[c](scales[c].domain()[0]),
                        value: 0
                    };
                }else{
                    notifyError(false);
                    pointPositions[c] = {
                        position: scales[c](convertedData[c]),
                        value: convertedData[c]
                    }
                }
            }
        }

        draw();
    }

    function get_translation(name, value) {
        switch (name) {
            case 'Appluimonia':
            case `Methylosmolene`: return {x:w/2, y:value}; //x stays constant, as we're moving along y axis

            case 'Chlorodinine':
            case 'AGOC-3A': return {x:value, y:h/2}; //y stays constant, as we're moving along x axis

            default: return {x:0, y:0};
        }
    }

    function draw(){   
        let points = [];
        for(let c in pointPositions){
            let translation = get_translation(c,pointPositions[c].position);
            points.push(translation);
        }

        points.push(points[0]);
        self.graph.select(`.current`).data([points])
            .transition().duration(50)
            .attr('d', lineFunction)
    }
}

let OverviewScatterPlot = function(parent, sensorNumber, scales, options){
    let self = this;

    options = options || {};
    //kiviat dimensions
    let min = d3.min([parent.node().offsetWidth, parent.node().offsetHeight]);
    let w = options.w || +min,
        h = options.h || +min*0.75;
    let padding = 20;
    let mode = ['days','weeks','months'];
    self.mode_index = -1;

    scales = scales || {}, axes = {};
    //used to draw the lines on the graph
    let lineFunction = d3.line()
        .x(function (d) { return d.x; })
        .y(function (d) { return d.y; });

    //create group on parent
    parent.append('svg').classed('overview_scatterplot', true).attr('id', `osp-sensor-${sensorNumber}`)
        .attr("transform", `scale(${options.scale || 1})`)
        // .attr('width',w).attr('height',h);
    self.graph = d3.select(`#osp-sensor-${sensorNumber}`);

    function drawAxes(){
        let time_coords = [[{x:padding,y:h-padding},{x:w-padding*2,y:h-padding},{x:padding,y:h-padding}]];
        let readings_coords = [[{x:padding,y:h-padding},{x:padding,y:padding},{x:padding,y:h-padding}]];
        // console.log(chemical,lineData[chemical]);
        axes.time = {
            regular: self.graph.append('path')
                .data(time_coords)
                .attr('class', 'axis')
                .attr('id', `osp-sensor${sensorNumber}-time-axis`)
                .attr('d', lineFunction),
            helper: self.graph.append('path')
                .data(time_coords)
                .attr('class', 'axis-mouseover')
                .attr('d', lineFunction)
                .attr('id', `osp-sensor${sensorNumber}-time-axis-helper`)
                .attr('value', 0)
                .on('mouseenter', function (d, i) {
                    // console.log("entered");
                    let value = d3.select(this).attr('value');
                    tooltip.setContent(`Time (${mode[self.mode_index]})`);
                    tooltip.showAt(d3.event.pageX, d3.event.pageY);
                }).on('mouseleave', function () {
                    tooltip.hide();
                    // console.log('left');
                })
        };

        axes.readings = {
            regular: self.graph.append('path')
                .data(readings_coords)
                .attr('class', 'axis')
                .attr('id', `osp-sensor${sensorNumber}-reading-axis`)
                .attr('d', lineFunction),
            helper: self.graph.append('path')
                .data(readings_coords)
                .attr('class', 'axis-mouseover')
                .attr('d', lineFunction)
                .attr('id', `osp-sensor${sensorNumber}-reading-axis-helper`)
                .attr('value', 0)
                .on('mouseenter', function (d, i) {
                    // console.log("entered");
                    let value = d3.select(this).attr('value');
                    tooltip.setContent(`Chemical Readings (parts per million, ppm)`);
                    tooltip.showAt(d3.event.pageX, d3.event.pageY);
                }).on('mouseleave', function () {
                    tooltip.hide();
                    // console.log('left');
                })
        }
    }

    self.changeTimeMode = function(){
        self.mode_index++;
        if(self.mode_index >= mode.length){
            self.mode_index = 0;
        }
        switch(mode[self.mode_index]){
            case 'days': scales.time = scales.time.domain([0, 100]); break;
            case 'weeks': scales.time = scales.time.domain([0, 15]); break;
            case 'months': scales.time = scales.time.domain([0, 2]); break;
        }

    }

    self.init = function () {
        scales.time = (scales.time || d3.scaleLinear().domain([0,2])).range([padding,w-padding*2]);
        scales.readings = (scales.readings || d3.scaleLinear().domain([0,2])).range([h-padding, padding]); //top axis;
        //all dimensions are relative to top left corner of group (0,0)
        scales.AppluimoniaX = (scales.Appluimonia || d3.scaleLinear().domain([0, 2])).range([h-padding, padding]); //top axis;

        scales.Chlorodinine = (scales.Chlorodinine || d3.scaleLinear().domain([0, 2])).range([h-padding, padding]); //right axis

        scales.Methylosmolene = (scales.Methylosmolene || d3.scaleLinear().domain([0, 2])).range([h-padding, padding]); //bottom axis

        scales['AGOC-3A'] = (scales['AGOC-3A'] || d3.scaleLinear().domain([0, 2])).range([h-padding, padding]); //left axis

        //draw axes
        drawAxes();
        self.changeTimeMode();

        //put sensor number
        self.graph.append('text').classed('sensor-label', true).attr('x', w * 0.9).attr('y', h * 0.25).text(sensorNumber);

    };

}
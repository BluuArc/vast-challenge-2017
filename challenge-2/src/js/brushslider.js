`use strict`;

var tooltip = tooltip || new Tooltip();

let TimeSlider = function(options){
    options = options || {};
    let self = this;
    let w = 800, h = 50;
    let padding = 12;
    let svg = d3.select('#timestamp-brush-slider').append('svg').classed('svg-content', true)
        .attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', `xMinYMin meet`);
    let scales = {}, axes = {};;
    let lines = [];
    let brush;
    let verbose = options.verbose || false;
    const chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];

    //default selections
    let selectedSensor = 'sensor1';
    let selectedChemical = 'Appluimonia'; 

    let line = d3.line()
        .x((d) => { return d.x; }).y((d) => { return d.y; });

    function drawPointAt(x, y) {
        if (x instanceof Vector) {
            y = x.y;
            x = x.x;
        }

        return svg.append('circle')
            .attr('r', 5)
            .attr('cx', x)
            .attr('cy', y);
    }

    function updateTimeRange(start,end,doFullUpdate){
        function convertDateToTimeStamp(date) {
            return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear() % 1000} ${date.getHours()}:00`;
        }
        d3.select('#time-range-start').text(convertDateToTimeStamp(start));
        d3.select('#time-range-end').text(convertDateToTimeStamp(end));
        if(doFullUpdate) options.jumpToTimeStamp(convertDateToTimeStamp(start));
    }

    self.init = function(options){
        // options = options || {};
        // let optionScales = options.scales || {
        //     Appluimonia: {},
        //     Chlorodinine: {},
        //     Methylosmolene: {},
        //     'AGOC-3A': {},
        // };

        let svgRange = {
            x: [padding, w-padding],
            y: [padding, h-padding]
        };

        //separate month scales into thirds, one for each month
        let monthScales = {};
        monthScales['April 2016'] = d3.scaleTime()
            .domain([new Date(2016,3,1), new Date(new Date(2016,4,1)-1)])
            .range([padding,(w/3)-padding]);
        monthScales['August 2016'] = d3.scaleTime()
            .domain([new Date(2016, 7, 1), new Date(new Date(2016, 8, 1) - 1)])
            .range([(w/3)-padding, (2*w/3)-padding]);
        monthScales['December 2016'] = d3.scaleTime()
            .domain([new Date(2016,11,1), new Date(new Date(2016,12,1)-1)])
            .range([(2*w/3)-padding,(w-padding)]);

        scales.monthScales = monthScales;

        //take every chemical scale and convert them to delta scales, where all input is output to a range of -1 and 1
        // let chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
        for(let c of chemical_names){
            let [min,max] = options.scales[c].domain();
            let globalMax = Math.max(Math.abs(max),Math.abs(min)); //get value furthest from 0 for uniform vertical scaling
            scales[c] = d3.scaleLinear().domain([globalMax,-globalMax]).range(svgRange.y);
            // console.log(c,[min,max],scales[c].domain());
        }

        //used for debugging positions
        scales.verticalScale = d3.scaleLinear().domain([1,-1]).range(svgRange.y);
        scales.horizontalScale = d3.scaleLinear().domain([0,3]).range(svgRange.x);

        for(let s in scales){
            if(typeof scales[s] === "function"){
                console.log(s,scales[s].domain(),scales[s].range());
            }
        }

        //draw background
        svg.append('rect').classed('slider-background',true)
            .attr('width',w-padding*2).attr('height',h-padding*2)
            .attr('x',padding).attr('y',padding);

        //draw indicator text
        let textIndicator = svg.append('foreignObject').classed('slider-text',true).attr('id','data-indicator')
            .attr('width', w).attr('height', padding * 0.9)
            .text('Chemical: chemical / Sensor: sensor').attr('x',padding).attr('y',0);
        tooltip.setEvents(textIndicator,`You can select time ranges here. The data shown is the delta (difference) of the readings of a given chemical and sensor over time`);

        //based on https://bl.ocks.org/mbostock/6232537
        drawAxes();
        drawRangeBrush();
    };

    function drawAxes(){
        let group = svg.append('g').classed('delta-axes',true);

        //create vertical axes
        for (let c of chemical_names) {
            axes[c] = d3.axisLeft(scales[c]).ticks(3).tickFormat(() => { return null; });
        }

        //draw 0 line
        group.append('path').classed('axis',true)
            .datum([new Vector(padding, scales.verticalScale(0)), new Vector(w - padding, scales.verticalScale(0))])
            .attr('d', line)
            .attr('stroke','black');


        //draw left axis
        group.append('g')
            .classed('axis', true)
            .classed('delta-axis-y', true)
            .attr('transform', `translate(${padding},0)`)
            .call(axes[selectedChemical]);

        //create horizontal axes
        let monthScales = scales.monthScales;
        for (let m in monthScales) {
            axes[m] = d3.axisBottom(monthScales[m])
                .ticks(d3.timeWeek)
                .tickPadding(0);
            //draw bottom axes
            group.append('g')
                .classed('axis', true)
                // .classed('axis-grid',true)
                .attr('transform', `translate(0,${h - padding})`)
                .call(axes[m])

            //draw daily dividers
            // group.append('g')
            //     .classed('axis', true).classed('minor-grid', true)
            //     .attr('transform', `translate(0,${h - padding})`)
            //     .call(d3.axisBottom(monthScales[m])
            //         .ticks(d3.timeDay)
            //         .tickSize(-h + padding * 2)
            //         .tickFormat(() => { return null; }))
            //     .selectAll('.tick').classed('tick-minor', true);
            //draw monthly dividers
            group.append('g')
                .classed('axis', true).classed('grid', true)
                .attr('transform', `translate(0,${h - padding})`)
                .call(d3.axisBottom(monthScales[m])
                    .ticks(d3.timeMonth)
                    .tickSize(-h + padding * 2)
                    .tickFormat(() => { return null; }));

            //draw top line
            group.append('g').classed('axis', true)
                .attr('transform', `translate(0,${padding})`)
                .call(d3.axisBottom(monthScales[m])
                    .ticks(d3.timeMonth)
                    .tickSize(0)
                    .tickFormat(() => { return null; }));

        }
        
    }

    function drawRangeBrush(){
        function brushended(){
            if (!d3.event.sourceEvent) return; // Only transition after input.
            if (!d3.event.selection) return; // Ignore empty selections.
            let brushRange;
            let left,right;
            let monthScales = Object.keys(scales.monthScales);
            let targetScale, prevScale;
            //get correct scale
            for(let m of monthScales){
                brushRange = d3.event.selection.map(scales.monthScales[m].invert);
                let monthRange = scales.monthScales[m].domain();
                if(brushRange[0] < monthRange[1] && !left){
                    left = brushRange[0];
                }
                if(brushRange[1] < monthRange[1] && !right){
                    right = brushRange[1];
                }
                if(left && right){
                    targetScale = scales.monthScales[m];
                    break;
                }
                prevScale = scales.monthScales[m];
            }
            targetScale = targetScale || prevScale;
            if(verbose) console.log("initial",brushRange);

            //snap to closest 12 hour
            brushRange[0] = d3.timeHour.floor(brushRange[0]);
            let next12 = d3.timeHour.offset(brushRange[0],12);
            let rightFloor = d3.timeHour.floor(brushRange[1]);
            if (rightFloor < next12) { //selection is less than 12 hours
                brushRange[1] = next12;
            } else {
                brushRange[1] = d3.timeHour.floor(brushRange[1]);
            }
            if(verbose) console.log("After hour rounding",brushRange);

            //if not in same month, snap to the month with largest diff
            right = right || d3.timeDay.offset(d3.timeMonth.offset(d3.timeMonth.floor(left)),-1); //fix for reaching end of scale
            if(left.getMonth() !== right.getMonth()){                
                //diffs are distances to edges of month
                let leftDiff = Math.abs(left.getDate() - d3.timeDay.offset(d3.timeMonth.floor(left), -1).getDate());
                let rightDiff = right.getDate();
                if(verbose) console.log(left, right, leftDiff, rightDiff);
                if(rightDiff > leftDiff){//snap to beginning of right
                    brushRange[0] = d3.timeMonth.floor(right);
                    brushRange[1] = d3.timeDay.offset(brushRange[0]);
                }else{//snap to end of left
                    targetScale = prevScale;
                    let nextMonth = d3.timeMonth.offset(d3.timeMonth.floor(left));
                    brushRange[1] = d3.timeHour.offset(nextMonth,-1);
                    brushRange[0] = d3.timeDay.offset(nextMonth,-1);
                }
            }
            if(verbose) console.log("After month rounding",brushRange);
            updateTimeRange(brushRange[0],brushRange[1],true);

            d3.select(this).transition().call(d3.event.target.move, brushRange.map(targetScale));
        }

        function onbrush(){
            if (!d3.event.sourceEvent) return; // Only transition after input.
            if (!d3.event.selection) return; // Ignore empty selections.

            let brushRange;
            let left, right;
            let monthScales = Object.keys(scales.monthScales);
            let targetScale, prevScale;
            //get correct scale
            for (let m of monthScales) {
                brushRange = d3.event.selection.map(scales.monthScales[m].invert);
                let monthRange = scales.monthScales[m].domain();
                if (brushRange[0] < monthRange[1] && !left) {
                    left = brushRange[0];
                }
                if (brushRange[1] < monthRange[1] && !right) {
                    right = brushRange[1];
                }
                if (left && right) {
                    targetScale = scales.monthScales[m];
                    break;
                }
                prevScale = scales.monthScales[m];
            }

            //snap to closest 12 hour
            brushRange[0] = d3.timeHour.floor(brushRange[0]);
            let next12 = d3.timeHour.offset(brushRange[0], 12);
            let rightFloor = d3.timeHour.floor(brushRange[1]);
            if (rightFloor < next12) { //selection is less than 12 hours
                brushRange[1] = next12;
            } else {
                brushRange[1] = d3.timeHour.floor(brushRange[1]);
            }

            //if not in same month, snap to the month with largest diff
            right = right || d3.timeDay.offset(d3.timeMonth.offset(d3.timeMonth.floor(left)), -1); //fix for reaching end of scale
            if (left.getMonth() !== right.getMonth()) {
                //diffs are distances to edges of month
                let leftDiff = Math.abs(left.getDate() - d3.timeDay.offset(d3.timeMonth.floor(left), -1).getDate());
                let rightDiff = right.getDate();
                if (verbose) console.log(left, right, leftDiff, rightDiff);
                if (rightDiff > leftDiff) {//snap to beginning of right
                    brushRange[0] = d3.timeMonth.floor(right);
                    brushRange[1] = d3.timeDay.offset(brushRange[0]);
                } else {//snap to end of left
                    targetScale = prevScale;
                    let nextMonth = d3.timeMonth.offset(d3.timeMonth.floor(left));
                    brushRange[1] = d3.timeHour.offset(nextMonth, -1);
                    brushRange[0] = d3.timeDay.offset(nextMonth, -1);
                }
            }
            updateTimeRange(brushRange[0], brushRange[1]);   
        }
        
        brush = d3.brushX()
            .extent([[padding,padding],[w-padding,h-padding]])
            .on('end',brushended)
            .on('brush',onbrush);
        let defaultRange = [
            (new Date(2016,3,1)),
            (new Date(2016,3,2))
        ];
        svg.append('g')
            .classed('brush',true)
            .call(brush)
            .call(brush.move, defaultRange.map((d) => { return scales.monthScales['April 2016'](d); }));
        updateTimeRange(defaultRange[0],defaultRange[1],true);
    }

    function drawTimeStampSelector(time_stamp){
        console.log("brushslider",time_stamp);
        let stampScale;
        //get month scale
        let date = new Date(time_stamp);
        for(let m in scales.monthScales){
            let monthRange = scales.monthScales[m].domain();
            if(date < monthRange[1]){
                stampScale = scales.monthScales[m];
                break;
            }
        }

        let xPos = stampScale(date);
        svg.selectAll('.timestamp-indicator').remove();
        svg.append('path').classed('timestamp-indicator',true)
            .datum([new Vector(xPos,padding),new Vector(xPos,h-padding)])
            .attr('d',line);
    }
    //data should have 2 fields: chemical and delta
    //chemical is a string with the chemical name
    //sensor is a string with the sensor name
    //delta should be in the same format as challenge2.data.delta
    // self.update = (time_stamp,sensor,chemical,data) => {
    //     if(time_stamp){
    //         drawTimeStampSelector
    //     }
    // };

    self.drawChemicalDelta = (chemical,sensor,data) => {
        // selectedChemical = chemical;
        // selectedSensor = sensor;
        console.log("received",chemical,sensor,data);

        if (sensor && sensor !== selectedSensor) {
            selectedSensor = sensor;
            svg.selectAll('.delta-notification').classed('inactive', true);
            svg.selectAll('.delta-line').classed('inactive', true);
            svg.selectAll(`#${selectedSensor}`).classed('inactive', false).raise();
        }

        if(chemical && chemical !== selectedChemical){
            selectedChemical = chemical

            let paths = {};
            for(let i = 1; i <= 9; ++i){
                paths[`sensor${i}`] = [];
                paths[`sensor${i}-NaN`] = [];
            }

            //generate path data
            for(let t in data){
                if(new Date(t) != "Invalid Date"){
                    for(let s in data[t]){
                        //get data point relative to SVG coordinates
                        let reading = data[t][s][selectedChemical];
                        let timestamp = (function(t){
                            let scale, date = new Date(t);
                            for(let m in scales.monthScales){
                                let monthRange = scales.monthScales[m].domain();
                                scale = scales.monthScales[m];
                                if(date < monthRange[1]){
                                    break;
                                }
                            }
                            return scale(date);
                        })(t);
                        let dataPoint = {
                            scaledReading: scales[selectedChemical](reading),
                            scaledTimestamp: timestamp,
                            reading: reading,
                            timestamp: t
                        }
                        if(!isNaN(reading)){
                            paths[s].push(dataPoint);
                        }else{
                            paths[`${s}-NaN`].push(dataPoint);
                        }
                    }
                }
            }

            //remove old points and paths
            svg.selectAll('.delta-line').remove();
            svg.selectAll('.delta-notification').remove();

            //plot points
            for(let p in paths){
                //plot erroneous points
                if(p.indexOf("NaN") > -1){
                    let max = scales.verticalScale(1);
                    for(let dataPoint of paths[p]){
                        // let point = drawPointAt(dataPoint.scaledTimestamp,max).attr('r',1)
                        let sensorName = p.replace("-NaN","");
                        let notification = svg.append('path').classed('delta-notification',true).attr('id',sensorName)
                            .datum([new Vector(dataPoint.scaledTimestamp,padding*0.9),new Vector(dataPoint.scaledTimestamp,h-padding)])
                            .attr('d',line).classed('inactive', sensorName !== selectedSensor);
                            tooltip.setEvents(notification,`${sensorName} has a NaN reading at ${dataPoint.timestamp}`);
                    }
                }else{
                    //plot path data
                    paths[p] = paths[p].sort((a,b) => {
                        return new Date(a.timestamp) - new Date(b.timestamp)
                    });
                    
                    let dataPoints = [];
                    let curMonth, curPoints = [];
                    //separate points by month
                    for (let point of paths[p]) {
                        if (!curMonth) {
                            curMonth = new Date(point.timestamp).getMonth();
                        } else if (new Date(point.timestamp).getMonth() !== curMonth) {
                            // console.log(point.timestamp);
                            dataPoints.push(curPoints);
                            curPoints = [];
                            curMonth = new Date(point.timestamp).getMonth();
                        }
                        curPoints.push(new Vector(point.scaledTimestamp, point.scaledReading));
                    }
                    dataPoints.push(curPoints);

                    //plot points by month
                    for(let arr of dataPoints){
                        svg.append('path').datum(arr)
                            .classed('delta-line', true).classed('inactive', p !== selectedSensor)
                            .attr('id', p)
                            .attr('d', line);
                    }
                }
            }

            console.log(paths);
        }

        d3.select('#data-indicator').html(`Delta Slider | Chemical: <p class="${selectedChemical} data-indicator-text">${selectedChemical}</p> / Sensor: <p class=data-indicator-text>${selectedSensor}</p>`);

    }

    self.updateTimeStamp = (time_stamp) => {
        drawTimeStampSelector(time_stamp);
    }


    
}
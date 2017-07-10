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
    let verbose = options.verbose || false;
    const chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];

    //default selections
    let selectedSensor = 'sensor1';
    let selectedChemical = 'Appluimonia'; 

    let line = d3.line()
        .x((d) => { return d.x; }).y((d) => { return d.y; });

    // self.updateTimeStampSelector = function(timestamp){
    //     // d3.select('#current-time-stamp').text(timestamp);
    //     options.jumpToTimeStamp(timestamp);
    // }

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
            .domain([new Date(2016,11,1), new Date(new Date(2017,0,1)-1)])
            .range([(2*w/3)-padding,(w-padding)]);

        scales.monthScales = monthScales;

        //take every chemical scale and convert them to delta scales, where all input is output to a range of -1 and 1
        // let chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
        for(let c of chemical_names){
            let [min,max] = options.scales[c].domain();
            let globalMax = Math.max(Math.abs(max),Math.abs(min)); //get value furthest from 0 for uniform vertical scaling
            scales[c] = d3.scaleLinear().domain([globalMax,globalMax]).range(svgRange.y);
            // console.log(c,[min,max],scales[c].domain());
        }

        //used for debugging positions
        scales.verticalScale = d3.scaleLinear().domain([-1,1]).range(svgRange.y);
        scales.horizontalScale = d3.scaleLinear().domain([0,3]).range(svgRange.x);

        //draw background
        svg.append('rect').classed('slider-background',true)
            .attr('width',w-padding*2).attr('height',h-padding*2)
            .attr('x',padding).attr('y',padding);

        //based on https://bl.ocks.org/mbostock/6232537
        drawAxes();
        drawRangeBrush();
    };

    function drawAxes(){
        let group = svg.append('g').classed('delta-axes',true);

        //create vertical axes
        for (let c of chemical_names) {
            axes[c] = d3.axisLeft(scales[c]).ticks(3);
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
            if (left.getMonth() !== right.getMonth()) {
                //diffs are distances to edges of month
                let leftDiff = Math.abs(left.getDate() - d3.timeDay.offset(d3.timeMonth.floor(left), -1).getDate());
                let rightDiff = right.getDate();
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
        
        let brush = d3.brushX()
            .extent([[padding,padding],[w-padding,h-padding]])
            .on('end',brushended)
            .on('brush',onbrush);
        svg.append('g')
            .classed('brush',true)
            .call(brush);
    }

    self.changeChemical = (newChemical) => {
        // let chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
        if(chemical_names.indexOf(newChemical) === -1){
            throw new Error(`Chemical ${newChemical} is not found.`);
        }else{
            selectedChemical = newChemical;
        }

        console.log("Selected chemical is now",selectedChemical);

    };

    //data should have 2 fields: chemical and delta
    //chemical is a string with the chemical name
    //sensor is a string with the sensor name
    //delta should be in the same format as challenge2.data.delta
    self.update = (data) => {

    };


    
}
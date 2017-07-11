`use strict`;

var tooltip = tooltip || new Tooltip();

let ChemicalOverviewChart = function(options){
    options = options || {};
    let self = this;
    let w = 400, h = 400;
    let padding = 25;
    let paddingLeft = 35, paddingRight = padding - paddingLeft;
    const chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
    let graphPadding = 10;
    let graphSize = (h-padding)/chemical_names.length - graphPadding;
    let graphs = [];

    let svg = d3.select('#overview-graph').append('svg').classed('svg-content', true)
        .attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', `xMinYMin meet`);

    let axes = {}, scales = {};

    let line = d3.line()
        .x((d) => { return d.x; }).y((d) => { return d.y; });

    //based off of https://bl.ocks.org/mbostock/34f08d5e11952a80609169b7917d4172
    self.init = function(options){
        let svgRange = {
            x: d3.scaleLinear().range([padding, w-padding]),
            y: d3.scaleLinear().range([padding, h-padding])
        };

        //create stacking scales from top to bottom
        for(let c of chemical_names){
            scales[c] = d3.scaleLinear().domain(options.scales[c].domain())
                .range([graphSize, 0]);
        }

        scales.x = d3.scaleTime().range(svgRange.x.range());
        scales.svgRange = svgRange; //can be used for debugging

        svg.append('defs').append('clipPath')
            .attr('id','clip')
            .append('rect')
            .attr('width')
        drawAxes();

        updateTimeScale("4/1/16 0:00", "4/2/16 0:00");
    };

    function drawAxes(){
        let group = svg.append('g').classed('overview-axes',true);
        axes.x = d3.axisBottom(scales.x).ticks(5);
        let defaultTickFormat = axes.x.tickFormat();
        
        //create axes for each graph
        let top = padding/2; //top of each graph
        for(let c of chemical_names){
            axes[c] = d3.axisLeft(scales[c]).tickValues(((range) => {
                return [range[0], (range[0]+range[1])/2, range[1]];
            })(scales[c].domain()));
            //vertical
            group.append('g').classed('axis',true).attr('id',c)
                .attr('transform',`translate(${paddingLeft},${top})`)
                .classed('overview-axis',true)
                .call(axes[c]);

            //only label ticks on last graph
            if (chemical_names.indexOf(c) !== chemical_names.length - 1){
                axes[`${c}-horizontal`] = axes.x.tickFormat(() => { return null; } );
            }else{
                axes[`${c}-horizontal`] = axes.x.tickFormat(defaultTickFormat);
            }
            
            //horizontal
            group.append('g').classed('axis', true).attr('id', c)
                .classed('time-axis', true)
                .attr('transform', `translate(${paddingLeft - padding},${top + graphSize})`)
                .classed('overview-axis', true)
                .call(axes[`${c}-horizontal`]);

            //chemical label
            svg.append('text').classed('axis-label',true).classed(c,true).classed('overview-axis',true)
                .attr('text-anchor','middle').attr('transform',`translate(${(paddingLeft-padding)},${top+graphSize/2}) rotate(-90)`)
                .text(c);
            top += graphSize + graphPadding;
        }
        console.log(axes);

    }

    function updateTimeScale(start,end){
        if(!scales.x) return;
        console.log("update time scale",start,end);
        let start_time = new Date(start);
        let end_time = new Date(end);
        scales.x.domain([start_time,end_time]);
        let defaultTickFormat = axes.x.tickFormat();
        for(let c of chemical_names){
            //only label ticks on last graph
            if (chemical_names.indexOf(c) !== chemical_names.length - 1) {
                axes[`${c}-horizontal`] = axes.x.tickFormat(() => { return null; });
            } else {
                axes[`${c}-horizontal`] = axes.x.tickFormat(defaultTickFormat);
            }
            svg.select(`.time-axis#${c}`).call(axes[`${c}-horizontal`]);
        }
    }
    
    self.update = function(start,end,data){
        updateTimeScale(start,end);

        let start_time = new Date(start);
        let end_time = new Date(end);
        //filter out data out of range
        let timestamps = Object.keys(data).filter((d) => {
            let date = new Date(d);
            return d >= start_time && d <= end_time;   
        }).sort((a,b) => { 
            return new Date(a) - new Date(b); 
        });

        
        //array of paths
        let paths = {
            'Appluimonia': {},
            'Chlorodinine': {},
            'Methylosmolene': {},
            'AGOC-3A': {},  
        }; 
        //array of points
        let erroneous = {
            'Appluimonia': {},
            'Chlorodinine': {},
            'Methylosmolene': {},
            'AGOC-3A': {},
        };
        //array of points; each array is one path
        let tempPaths = {
            'Appluimonia': {},
            'Chlorodinine': {},
            'Methylosmolene': {},
            'AGOC-3A': {},
        };
        for(let c in tempPaths){
            for (let i = 1; i <= 9; ++i) {
                tempPaths[c][`sensor${i}`] = [];
            }
        }
        //create path points
        for(let t of timestamps){
            for(let s of timestamps[t]){
                for(let c of timestamps[t][s]){
                    let readings = timestamps[t][s][c];
                    if(readings.length === 1){
                        tempPaths[c][s].push({
                            reading: readings[0],
                            timestamp: t,
                            scaledReading: scales[c](readings[0]),
                            scaledTime: scales.x(t)
                        });
                    }else{ //erroneous
                        if (!erroneous[c][s]){
                            erroneous[c][s] = [];
                        }
                        erroneous[c][s].push(t);

                        //push current stuff and reset array, if necessary
                        if(!paths[c][s]){
                            paths[c][s] = [];
                        }
                        if(tempPaths[c][s].length > 1){
                            paths[c][s].push(tempPaths[c][s]);
                            tempPaths[c][s] = [];
                        }
                    }
                }
            }
        }
        //push any remaining data
        for(let c in tempPaths){
            for(let s in tempPaths[c]){
                if (!paths[c][s]) {
                    paths[c][s] = [];
                }
                if(tempPaths[c][s].length > 1){
                    paths[c][s].push(tempPaths[c][s]);
                }
            }
        }

        //plot chemical data
        svg.selectAll('.overview-path').remove();
        let c = 'Appluimonia';
        // for(let c in paths){
            for(let s in paths[c]){
                for(let p of paths[c][s]){ //for every path
                    let points = p.map((d) => { return new Vector(d.scaledTime,d.scaledReading)});
                    svg.append('path').datum(points)
                        .classed('overview-line',true)
                        .attr('id',s)
                        .attr('d',line);
                }
            }
        // }
        
    }

    function updateTimeSelector(time_stamp){
        console.log("updateTimeSelector",time_stamp);
        let xPos = scales.x(new Date(time_stamp)) + (paddingLeft-padding)+1;
        svg.selectAll('.timestamp-indicator').remove();
        svg.append('path').classed('timestamp-indicator', true)
            .datum([new Vector(xPos, graphPadding), new Vector(xPos, (h - padding)+5)])
            .attr('d', line);
    }
    self.updateTimeSelector = updateTimeSelector;

}

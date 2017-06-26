//based on http://bl.ocks.org/d3noob/a22c42db65eb00d4e369

var Tooltip = function(){
    let self = this;
    // self.div = d3.select('div.tooltip').style('opacity',0);

    self.showAt = function(x,y){
        // console.log('received coords',x,y);
        div = d3.select('div.tooltip');
        div.style('opacity', 1)
            .style('left', `${x}px`)
            .style('top',  `${y-28}px`);
    };

    self.setContent = function(content){
        // console.log('received content',JSON.stringify(content,null,2));
        div = d3.select('div.tooltip');
        div.html(content);
    }

    self.hide = function(){
        // console.log('hiding');
        div = d3.select('div.tooltip');
        div.style('opacity',0);
    }
};
"use client"
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { RechartsDevtools } from '@recharts/devtools';
import { useEffect,useState } from 'react';

// #region Sample data
const data = [
  {
    name: 'Page A',
    uv: 4000,
    pv: 2400,
    amt: 2400,
  }
];


export const AreaChartExample = ({data_gotten})=>{
    const [currCol,setCurrCol]= useState();
    const [currCol1,setCurrCol1]= useState();
    let new_data_list = data_gotten.map(item => ({
       name: item.name,
        ...item.metrics
    }));

    const key_dat = Object.entries(new_data_list[0]);
    const color = ['#861142','#ff85b8','#153441','#0059ff','#a9c700','#06522c','#05e2ff','#ff6701'];

    function getRandomIntInt() {
        const minCeiled = Math.ceil(0);
        const maxFloored = Math.floor(7);

        // The maximum is inclusive and the minimum is inclusive
        return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
    }
    useEffect(()=>{
        setCurrCol(color[getRandomIntInt()])
        setCurrCol1(color[getRandomIntInt()])
    },[])

    return(
      <AreaChart
        style={{ width: '100%', maxWidth: '400px', maxHeight: '40vh', aspectRatio: 1.618, border:'1px solid gray' }}
        responsive
        data={new_data_list}
        margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
      >
        <defs>
            <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
            </linearGradient>
        </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis width="auto" />
          <Tooltip />
      
          {key_dat.map(([keys,value])=>{
              if(keys !== "name"){
                  return  <Area
                      key={keys}
                      type="monotone"
                      dataKey={keys}
                      stroke={setCurrCol}
                      fillOpacity={0.5}
                      fill={setCurrCol1}
                      isAnimationActive={true}
                  />
              }  
          })}
          <RechartsDevtools />
        </AreaChart>
    )
}

// #endregion


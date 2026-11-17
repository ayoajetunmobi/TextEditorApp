"use client"
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { RechartsDevtools } from '@recharts/devtools';

// #region Sample data
const data = [
  {
    name: 'Page A',
    uv: 4000,
    pv: 2400,
    amt: 2400,
  },
  {
    name: 'Page B',
    uv: 3000,
    pv: 1398,
    amt: 2210,
  }
];

// #endregion
export const StackedBarChart = ({data_gotten}) => {
  const [currCol,setCurrCol]= useState();
  
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
  useState(()=>{
    setCurrCol(color[getRandomIntInt()])
  },[])
  return (
    <BarChart
      style={{ width: '100%', maxWidth: '400px', maxHeight: '40vh', aspectRatio: 1.618,  border:'1px solid gray' }}
      responsive
      data={new_data_list}
      margin={{
        top: 20,
        right: 0,
        left: 0,
        bottom: 5,
      }}
    >
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="name" niceTicks="snap125" />
      <YAxis width="auto" niceTicks="snap125" />
      <Tooltip />
      <Legend />
        {key_dat.map(([keys,value])=>{
            if(keys !== "name"){
                return <Bar key={keys} dataKey={keys} stackId="a" fill={setCurrCol} background />
            }  
        })}  
      <RechartsDevtools />
    </BarChart>
  );
};
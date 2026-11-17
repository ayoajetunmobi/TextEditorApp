import { Pie, PieChart, Tooltip, TooltipIndex } from 'recharts';
import { RechartsDevtools } from '@recharts/devtools';
import { useState } from 'react';

// #region Sample data
const data01 = [
  { name: 'Group A', value: 400 },
  { name: 'Group B', value: 300 },
  { name: 'Group C', value: 300 },
  { name: 'Group D', value: 200 },
];
const data02 = [
  { name: 'A1', value: 100 },
  { name: 'A2', value: 300 },
  { name: 'B1', value: 100 },
  { name: 'B2', value: 80 },
  { name: 'B3', value: 40 },
  { name: 'B4', value: 30 },
  { name: 'B5', value: 50 },
  { name: 'C1', value: 100 },
  { name: 'C2', value: 200 },
  { name: 'D1', value: 150 },
  { name: 'D2', value: 50 },
];

// #endregion
export function TwoLevelPieChart({data_gotten}){
  const [currCol,setCurrCol]= useState();
  let new_data_list = data_gotten.map(item => ({
      name: item.name,
      ...item.metrics
  }));
  
  const color = ['#2b2729','#ff85b8','#153441','#0059ff','#a9c700','#06522c','#05e2ff','#ff6701'];
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
    <PieChart
      style={{ width: '100%', height: '100%', maxWidth: '400px', maxHeight: '40vh', aspectRatio: 1 , border:'1px solid gray'}}
      responsive
    >
      <Pie
        data={new_data_list}
        dataKey="value"
        cx="50%"
        cy="50%"
        outerRadius="50%"
        fill={setCurrCol}
        isAnimationActive={true}
      />
      {/* <Pie
        data={data02}
        dataKey="value"
        cx="50%"
        cy="50%"
        innerRadius="60%"
        outerRadius="80%"
        fill="#82ca9d"
        label
        isAnimationActive={true}
      /> */}
      <Tooltip defaultIndex={true} />
      <RechartsDevtools />
    </PieChart>
  );
}
"use client"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { RechartsDevtools } from '@recharts/devtools';
import { useEffect, useState } from 'react';

// #region Sample data

// #endregion

export function LineChartFunc({data_gotten}) {
    const [currCol,setCurrCol]= useState();
    const [currCol1,setCurrCol1]= useState();
    const [currCol2,setCurrCol2]= useState();
    let new_data_list = data_gotten.map(item => ({
        name: item.name,
        ...item.metrics
    }));

    const key_dat = Object.entries(new_data_list[0]);
    const color = ['#2b2729','#ff85b8','#153441','#0059ff','#a9c700','#06522c','#05e2ff','#ff6701'];
    
    function getRandomIntInt() {
        const minCeiled = Math.ceil(0);
        const maxFloored = Math.floor(7);
        // The maximum is inclusive and the minimum is inclusive
        return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
    }

    useEffect(()=>{
        setCurrCol(color[getRandomIntInt()])
        setCurrCol1(color[getRandomIntInt()])
        setCurrCol2(color[getRandomIntInt()])
    },[])

    return (
        <LineChart
            style={{ width: '100%', maxWidth: '400px', height: '100%', maxHeight: '40vh', aspectRatio: 1.618, border:'1px solid gray' }}
            responsive
            data={new_data_list}
            margin={{
                top: 5,
                right: 0,
                left: 0,
                bottom: 5,
            }}
        >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-3)" />
        <XAxis dataKey="name" stroke="var(--color-text-3)" />
        <YAxis width="auto" stroke="var(--color-text-3)" />
        <Tooltip
            cursor={{
            stroke: 'var(--color-border-2)',
            }}
            contentStyle={{
            backgroundColor: 'var(--color-surface-raised)',
            borderColor: 'var(--color-border-2)',
            }}
        />
        <Legend />
        {key_dat.map(([keys,value])=>{
            if(keys !== "name"){
                return  <Line key={keys}
                    type="monotone"
                    dataKey={keys}
                    stroke={setCurrCol}
                    dot={{
                    fill:setCurrCol1,
                    }}
                    activeDot={{stroke: setCurrCol2}}
                />
            }  
        })}  
        <RechartsDevtools />
        </LineChart>
    );
}

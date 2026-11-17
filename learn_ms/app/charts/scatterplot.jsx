import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { RechartsDevtools } from '@recharts/devtools';


// #region Sample data
const data01 = [
  { x: 100, y: 200 },
  { x: 120, y: 100 },
  { x: 170, y: 300 },
  { x: 140, y: 250 },
  { x: 150, y: 400 },
  { x: 110, y: 280 },
];


// #endregion
export function ScatterChartExample({ data_gotten, isAnimationActive = true }){
    let new_data_list = data_gotten.map(item => ({
        ...item.metrics
    }));

    const color = ['#861142','#ff85b8','#153441','#0059ff','#a9c700','#06522c','#05e2ff','#ff6701'];
    function getRandomIntInt() {
        const minCeiled = Math.ceil(0);
        const maxFloored = Math.floor(7);

        // The maximum is inclusive and the minimum is inclusive
        return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
    }


    return(     
        <ScatterChart
            style={{ width: '100%', maxWidth: '400px', maxHeight: '40vh', aspectRatio: 1.618, border:"1px solid gray" }}
            responsive
            margin={{
            top: 20,
            right: 20,
            bottom: 10,
            left: 10,
            }}
        >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" type="number" name="stature" unit="cm" />
            <YAxis dataKey="y" type="number" name="weight" unit="" width="auto" />
            <ZAxis dataKey="z" type="number" range={[64, 144]} name="score" unit="km" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend />

         
            <Scatter name={"scatter plot"} data={new_data_list} fill={color[getRandomIntInt]} isAnimationActive={ isAnimationActive } />
            <RechartsDevtools />
        </ScatterChart>
    )
}
import mysql from 'mysql2';
import XLSX from 'xlsx';
import mssql from 'mssql';

let mssqlConnectionWorkbook = XLSX.readFile('config/connection_mssql.xlsx');
let mysqlConnectionWorkbook = XLSX.readFile('config/connection_mysql.xlsx');

let mssqlConfig = {
    user: mssqlConnectionWorkbook.Sheets['MSSQL']['B2'].v,
    password: mssqlConnectionWorkbook.Sheets['MSSQL']['B3'].w,
    server: mssqlConnectionWorkbook.Sheets['MSSQL']['B4'].v,
    database: mssqlConnectionWorkbook.Sheets['MSSQL']['B5'].v,
    pollingTimer: mssqlConnectionWorkbook.Sheets['MSSQL']['B6'].v,
}

let mysqlConfig = {
    host: mysqlConnectionWorkbook.Sheets['MYSQL']['B2'].v,
    port: mysqlConnectionWorkbook.Sheets['MYSQL']['B3'].w,
    user: mysqlConnectionWorkbook.Sheets['MYSQL']['B4'].v,
    password: (mysqlConnectionWorkbook.Sheets['MYSQL']['B5'] != undefined) ? mysqlConnectionWorkbook.Sheets['MYSQL']['B5'].w : '',
    database: mysqlConnectionWorkbook.Sheets['MYSQL']['B6'].v,
}

const mssqlConnection = new mssql.ConnectionPool({
    user: mssqlConfig.user,
    password: mssqlConfig.password,
    server: mssqlConfig.server,
    database: mssqlConfig.database
});

const mysqlConnection = mysql.createConnection({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
});


const pollingTimer = mssqlConfig.pollingTimer; //Таймер опроса БД в миллисекундах

mysqlConnection.connect(function (err) 
{
    if (err) throw err;
    console.log("Подключился к MySql");
});

mssqlConnection.connect(err => {
    if (err) throw err;

    console.log("Подключился к MsSQL");
    
    let promiseLastDate = new Promise(function(resolve)
    {
        mssqlConnection.request().query(`select top 1 [DtPriem] from [ResIsmEnergy] 
            Where [Command] = 66 order by [DtPriem] DESC`, (err, result) => 
            {
                if (err) throw err;

                //console.log(result.recordset);

                let {DtPriem} = result.recordset[0];

                resolve(DtPriem);
            });
    });

    promiseLastDate.then(lastDate =>
    {

        setInterval(() => 
        {
            let promiseCheckDate = new Promise(function(resolve)
            {
                mssqlConnection.request().query(`select top 1 [DtPriem] from ResIsmEnergy 
                    Where [Command] = 66 order by [DtPriem] DESC`, (err, result) => 
                    {
                        if (err) throw err;

                        let {DtPriem} = result.recordset[0];

                        if (lastDate < DtPriem)
                        {
                            resolve(DtPriem)
                        }else
                        {
                            console.log(`Считываются данные`);
                            console.log(`Последнее время опроса: ${lastDate}`);
                            console.log(`Текущее время: ${DtPriem}`);
                        };
                    });
            });

            promiseCheckDate.then((DtPriem) =>
            {
                console.log("Данные обрабатываются");

                let parseLastDate = new Date(Date.parse(lastDate));

                //parseLastDate = new Date(2020, 7, 19, 12, 0, 0);

                console.log(`${parseLastDate.getFullYear()}-${parseLastDate.getMonth() + 1}-${parseLastDate.getDate()} ${parseLastDate.getHours()}:${parseLastDate.getMinutes()}:${parseLastDate.getSeconds()}`);
                mssqlConnection.request().query(`select [IdShet] from ResIsmEnergy 
                    Where [Command] = 66 and ([DtPriem] BETWEEN '${parseLastDate.getFullYear()}-${parseLastDate.getMonth() + 1}-${parseLastDate.getDate()} ${parseLastDate.getHours()}:${parseLastDate.getMinutes()}:${parseLastDate.getSeconds()}'
                    and CURRENT_TIMESTAMP)`, (err, result) => 
                    {
                        if (err) throw err;

                        let arrShet = [];

                        for (let value of result.recordset)
                        {
                            let {IdShet} = value;

                            let shet = arrShet.find(shet => shet.id == IdShet)

                            if (shet)
                            {
                                shet.repetitions += 1;
                            }else
                            {
                                arrShet.push({id: IdShet, repetitions: 2});
                            }
                        }


                        for (let shet of arrShet)
                        {
                            mssqlConnection.request().query(`select top ${shet.repetitions} [IdShet], [ActMin], [DtPriem] from ResIsmEnergy 
                                Where [Command] = 66 and [IdShet] = ${shet.id} order by [DtPriem] DESC`, (err, result) => 
                                {
                                    createTrendLine(result.recordset);
                                });
                        }   

                        lastDate = DtPriem;
                    });
            });
        }, pollingTimer);      
    });

});

mssqlConnection.on('error', err => {
    console.log(`Произошла ошибка ${err}`);
});

function createTrendLine(data)
{
    // data = [
    //     {ActMin: 0.35, DtPriem: "2020-09-22T09:00:00.000Z"},
    //     {ActMin: 0.36, DtPriem: "2020-09-22T09:00:20.000Z"},
    //     {ActMin: 0.35, DtPriem: "2020-09-22T09:00:40.000Z"},
    //     {ActMin: 0.36, DtPriem: "2020-09-22T09:01:00.000Z"},
    // ];

    data.sort(function (a, b)
    {
        if (a.DtPriem > b.DtPriem) {
            return 1;
          }
          if (a.DtPriem < b.DtPriem) {
            return -1;
          }
          
          return 0;
    });

    console.log(data);


    let changeData = [];

    for (let obj of data)
    {
        let x = new Date(obj.DtPriem);
        //.setHours(new Date(obj.DtPriem).getHours() + 3)
        let y = obj.ActMin;
        changeData.push({x: x, y: y})
    }

    let b = SlopeCalculation(changeData);
    let a = LineSegmentCalculation(changeData, b);

    SendDataMySql();
    let trendLine = [];

    for (let x = changeData[0].x; x <= changeData[data.length - 1].x; x.setSeconds(x.getSeconds() + 1))
    {
        let y = b * x + a;
        trendLine.push([new Date(x), y]);
    }

    console.log(trendLine);

    // return trendLine;
}

//Вычисление наклона
//Формула:
//b = E(x - x_ср) * (y - y_ср) / E(x - x_ср) * (x - x_ср)
function SlopeCalculation(data)
{
    let sumNumerator = 0; //Сумма числителя
    let sumDenominator = 0; //Сумма знаменателя
    let xAverage = 0; //Среднее арифметическое x
    let yAverage = 0; //Среднее арифметическое y

    for (let i = 0; i < data.length; i++)
    {
        xAverage += +data[i].x;
        yAverage += data[i].y;
    }

    xAverage /= data.length;
    yAverage /= data.length;


    for (let i = 0; i < data.length; i++)
    {
        sumNumerator += (+data[i].x - xAverage) * (data[i].y - yAverage);

        sumDenominator += Math.pow((+data[i].x - xAverage), 2);
    }

    let b = sumNumerator / sumDenominator;

    console.log(`Наклон: ${b}`);

    return b;
}

//Вычисление отрезка
//Формула:
//a = y_ср - b * x_ср
function LineSegmentCalculation(data, b)
{
    let xAverage = 0; //Среднее арифметическое x
    let yAverage = 0; //Среднее арифметическое y

    for (let i = 0; i < data.length; i++)
    {
        xAverage += +data[i].x;
        yAverage += data[i].y;
    }

    xAverage /= data.length;
    yAverage /= data.length;

    let a = +(yAverage - b * xAverage).toFixed(2);

    console.log(`Отрезок: ${a}`);

    return a;
}


function SendDataMySql()
{

}
import mysql from 'mysql2';
import XLSX from 'xlsx';
import mssql from 'mssql';
import userInput from 'synchronous-user-input';
import fs from 'fs';

// let mssqlConnectionWorkbook = XLSX.readFile('config/config_mssql.xlsx');
// let mysqlConnectionWorkbook = XLSX.readFile('config/config_mysql.xlsx');
let mssqlConnection;
let mysqlConnection;
let mssqlConfig;
let mysqlConfig;
let config;

main();


function main()
{
    // let date = new Date('2020-02-27T11:37:00');
    // let lol = {
    //     lastDate: date
    // }

    // let lolJSON  = JSON.stringify(lol);

    // fs.writeFileSync(`config/config.json`, lolJSON); 

    readFiles();
}

function readFiles()
{
    fs.readFile(`config/config.json`, (err, data) =>
    {
        if (err)
        {
            throw err;
        }else
        {
            config = JSON.parse(data);
        }
    });
    
    let readFileMsSql = new Promise((resolve) =>
    {
        fs.readFile(`config/config_mssql.json`, (err, data) =>
        {
            if (err)
            {
                if (err.code == `ENOENT`)
                {
                    mssqlConfig = setMsSqlConfig();
                    resolve(mssqlConfig);
                }
            }else
            {
                mssqlConfig = JSON.parse(data);
                resolve(mssqlConfig);
            }
        });
    });

    let readFileMySql = new Promise((resolve) =>
    {
        fs.readFile(`config/config_mysql.json`, (err, data) =>
        {
            if (err)
            {
                if (err.code == `ENOENT`)
                {
                    mysqlConfig = setMySqlConfig();
                    
                    resolve(mysqlConfig);
                }
            }else
            {
                mysqlConfig = JSON.parse(data);
                resolve(mysqlConfig);
            }
        });
    });


    let promiseFiles = [readFileMsSql, readFileMySql];

    Promise.all(promiseFiles).then(() =>
    {
        mySqlConnect(mysqlConfig);
        msSqlConnect(mssqlConfig);
    });
}

// let mssqlConfig = {
//     user: mssqlConnectionWorkbook.Sheets['MSSQL']['B2'].v,
//     password: mssqlConnectionWorkbook.Sheets['MSSQL']['B3'].w,
//     server: mssqlConnectionWorkbook.Sheets['MSSQL']['B4'].v,
//     database: mssqlConnectionWorkbook.Sheets['MSSQL']['B5'].v,
//     pollingTimer: mssqlConnectionWorkbook.Sheets['MSSQL']['B6'].v,
//     beginningOfTheDay: mssqlConnectionWorkbook.Sheets['MSSQL']['B7'].w,
//     isMeterReading: mssqlConnectionWorkbook.Sheets['MSSQL']['B8'].v,
// }

// let mysqlConfig = {
//     host: mysqlConnectionWorkbook.Sheets['MYSQL']['B2'].v,
//     port: mysqlConnectionWorkbook.Sheets['MYSQL']['B3'].w,
//     user: mysqlConnectionWorkbook.Sheets['MYSQL']['B4'].v,
//     password: (mysqlConnectionWorkbook.Sheets['MYSQL']['B5'] != undefined) ? mysqlConnectionWorkbook.Sheets['MYSQL']['B5'].w : '',
//     database: mysqlConnectionWorkbook.Sheets['MYSQL']['B6'].v,
// }

function mySqlConnect()
{
    mysqlConnection = mysql.createConnection(mysqlConfig);

    mysqlConnection.connect(function (err) 
    {
        if (err)
        {
            console.dir("Произошла ошибка с подключением к базе данных MYSQL");
            throw err
        };
        console.log("Подключился к MySql");
    });
}

function msSqlConnect()
{
    mssqlConnection = new mssql.ConnectionPool(mssqlConfig);

    mssqlConnection.connect(async err => {
        if (err)
        {
            console.dir("Произошла ошибка с подключением к базе данных MSSQL");
            console.log(err);
            process.exit(0);     
        };
        console.log("Подключился к MsSQL");
    
        if (mssqlConfig.isMeterReading) setStartDate();
    
        //Занесение показаний счётчиков на начало суток
        // setTimeout(function request()
        // {
        //     let date = new Date(Date.now());
    
        //     let [hours, minutes] = mssqlConfig.beginningOfTheDay.split(`:`);
    
        //     if (date.getHours() == +hours && date.getMinutes() == +minutes)
        //     {
        //         setStartDate();
        //     }else
        //     {
        //         setTimeout(request, 10000);
        //     }
        // }, 10000);
    
        let lastDate = new Date(config.lastDate);
    
        setInterval(() =>
        {
            sampleWorkNumber(lastDate);
            lastDate = new Date(Date.now());
        }, mssqlConfig.pollingTimer);
    
    });

    mssqlConnection.on('error', err => {
        console.log(`Ошибка подключения к MsSql: ${err}`);
    });
}

function dataProcessing(data, numShet)
{
    //console.log(data);
    //console.log(numShet);
    let tokA = createTrendLine(data, "TokA");
    let tokB = createTrendLine(data, "Tokb");
    let tokC = createTrendLine(data, "TokC");

    let naprA = createTrendLine(data, "NaprA");
    let naprB = createTrendLine(data, "Naprb");
    let naprC = createTrendLine(data, "NaprC");

    let cosA = createTrendLine(data, "CosA");
    let cosB = createTrendLine(data, "CosB");
    let cosC = createTrendLine(data, "CosC");
    // console.log(cosA);
    // console.log('-----------------------------------------------');
    // console.log(cosB);
    // console.log('-----------------------------------------------');
    // console.log(cosC);
    // console.log('-----------------------------------------------');
    // console.log(naprA);
    // console.log('-----------------------------------------------');
    // console.log(naprB);
    // console.log('-----------------------------------------------');
    // console.log(naprC);
    // console.log('-----------------------------------------------');
    //console.log(naprA);
    //console.log(data);
    //console.log(naprA);

    for (let i = 0; i < cosA.length; i++)
    {
        SendDataMySql(
            {
                numShet: numShet, 
                fullDate: naprA[i].x,
                tokA: tokA[i].y.toFixed(2),
                tokB: tokB[i].y.toFixed(2),
                tokC: tokC[i].y.toFixed(2),
                naprA: naprA[i].y.toFixed(2),
                naprB: naprB[i].y.toFixed(2),
                naprC: naprC[i].y.toFixed(2),
                cosA: cosA[i].y.toFixed(1),
                cosB: cosB[i].y.toFixed(1),
                cosC: cosC[i].y.toFixed(1), 
            }
        );
    }
    //console.log('-----------------------------------------------');
}

//Линейная аппроксимация
function createTrendLine(data, prop)
{

    switch(prop)
    {
        case "TokA" || "Tokb" || "TokC":
        {
            data.sort(function (a, b)
            {
                if (a.DtTok > b.DtTok) 
                {
                    return 1;
                }
                if (a.DtTok < b.DtTok) 
                {
                    return -1;
                }
                
                return 0;
            });
            break;
        }

        case "NaprA" || "Naprb" || "NaprC":
        {
            data.sort(function (a, b)
            {
                if (a.DtNapr > b.DtNapr) 
                {
                    return 1;
                }
                if (a.DtNapr < b.DtNapr) 
                {
                    return -1;
                }
                
                return 0;
            });
            break;
        }

        case "CosA" || "CosB" || "CosC":
        {
            data.sort(function (a, b)
            {
                if (a.Dtcos > b.Dtcos) 
                {
                    return 1;
                }
                if (a.Dtcos < b.Dtcos) 
                {
                    return -1;
                }
                
                return 0;
            });
            break;
        }
    }

    // console.log(data);

    let changeData = [];

    for (let obj of data)
    {
        let x;
        let y;
        
        switch(prop)
        {
            case "TokA":
            {
                x = new Date(obj.Dtcos);
                y = obj.TokA;
                break;
            }

            case "Tokb":
            {
                x = new Date(obj.Dtcos);
                y = obj.Tokb;
                break;
            }

            case "TokC":
            {
                x = new Date(obj.Dtcos);
                y = obj.TokC;
                break;
            }

            case "NaprA":
            {
                x = new Date(obj.DtNapr);
                y = obj.NaprA;
                break;
            }

            case "Naprb":
            {
                x = new Date(obj.DtNapr);
                y = obj.Naprb;
                break;
            }

            case "NaprC":
            {
                x = new Date(obj.DtNapr);
                y = obj.NaprC;
                break;
            } 

            case "CosA":
            {
                x = new Date(obj.DtTok);
                y = obj.CosA;
                break;
            }

            case "CosB":
            {
                x = new Date(obj.DtTok);
                y = obj.CosB;
                break;
            }

            case "CosC":
            {
                x = new Date(obj.DtTok);
                y = obj.CosC;
                break;
            }
        }
        
        changeData.push({x: x, y: y})
    }

    //console.log(changeData);
    

    let b = SlopeCalculation(changeData);
    let a = LineSegmentCalculation(changeData, b);

    let trendLine = [];

    for (let x = changeData[0].x; x <= changeData[data.length - 1].x; x.setSeconds(x.getSeconds() + 1))
    {
        let y = b * x + a;
        trendLine.push({x: new Date(x), y: y});
    }

    //console.log(trendLine);

    //console.log("---------------------------------------------");

    return trendLine;
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

    //console.log(`Наклон: ${b}`);

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

    //console.log(`Отрезок: ${a}`);

    return a;
}

//Получение мгновенных значений для всех счётчиков
async function sampleWorkNumber(lastDate)
{
    let shetSet = new Set();
    let dateNow = new Date(Date.now());
    dateNow.setHours(dateNow.getHours() + 3);
    lastDate.setHours(lastDate.getHours() + 3);

    console.log(`Опрос данных между ${lastDate.toISOString()} и ${dateNow.toISOString()}`);

    mssqlConnection.request().query(`SELECT WorkNumber, idShet FROM ${mssqlConfig.database}.[dbo].[Shet] Where prActiv=1 ORDER BY [idShet]`, async(err, result) =>
        {
            if (err) throw err;
            
            for (let row of result.recordset)
            {
                let {WorkNumber, idShet} = row;

                if (!shetSet.has(WorkNumber))
                {
                    getInstantaneousValues(WorkNumber, idShet, lastDate, dateNow);     
                }
                
                shetSet.add(WorkNumber);
            }
        });
        // return new Promise(resolve => setTimeout(
        //     () =>
        //     {
        //         const val = Math.trunc(Math.random() * 100);
        //         resolve(val);
        //     }, 2000
        // ));
}

let counter = 0;
//Получение мгновенных значений по WorkNumber
async function getInstantaneousValues(WorkNumber, idShet, lastDate, dateNow)
{
    //20200227 11:37:00

    mssqlConnection.query(`use [${mssqlConfig.database}]
        declare @num varchar(100), @KT int, @KN int
        /**/
        Set @num = ${WorkNumber}
        /**/
        set @KT = (select distinct KtrTok from Shet where WorkNumber = @num and prActiv = 1) 
        Set @KN = (select distinct KtrNapr from Shet where WorkNumber = @num and prActiv = 1) 
        
        select IdDtLabel as IdDtLabel1, DtPriem as Dttok, 
        ActMin*@KT As TokA, 
        ReactPl*@KT As Tokb, 
        ReactMin*@KT As tokC into #newt 
        from [${mssqlConfig.database}].[dbo].[ResIsmEnergy]
        where [Command]=66 and 
        [${mssqlConfig.database}].[dbo].[ResIsmEnergy].[IdShet]=${idShet}

        select IdDtLabel as IdDtLabe2, DtPriem as DtNapr,  
        ActMin*@KN As NaprA, 
        ReactPl*@KN As Naprb,
        ReactMin*@KN As NaprC into #newn 
        from [${mssqlConfig.database}].[dbo].[ResIsmEnergy]
        where [Command]=65 and [${mssqlConfig.database}].[dbo].[ResIsmEnergy].[IdShet]=${idShet}

        select IdDtLabel as IdDtLabe3, 
        DtPriem as DtCos, 
        ActMin As CosA,
        ReactPl As Cosb,
        ReactMin As CosC 
        into #newc
        from [${mssqlConfig.database}].[dbo].[ResIsmEnergy]
        where [Command]=64 and [${mssqlConfig.database}].[dbo].[ResIsmEnergy].[IdShet]=${idShet} and (DtPriem BETWEEN '${lastDate.toISOString()}' and '${dateNow.toISOString()}')

        select @num as NumShet, 
        Dtcos, CosA, CosB, CosC, 
        DtNapr, NaprA, Naprb, NaprC, 
        DtTok, TokA, Tokb, TokC
        from #newc
        left join #newn
        on #newc.IdDtLabe3 = #newn.IdDtLabe2
        left join #newt
        on #newt.IdDtLabel1 = #newc.IdDtLabe3
        order by Dttok
        drop table #newn
        drop table #newt
        drop table #newc`, async(err, result) =>
        {
            if (err) throw err;       

            if (result.recordset[0] != undefined) 
            {
                counter++;
                let {NumShet, DtNapr} = result.recordset[0];
                dataProcessing(result.recordset, NumShet);
                //console.log(NumShet);
                console.log(counter);
                console.log(NumShet);
                //console.log(new Date(Date.now()));
                console.log(DtNapr)

            }       
        });
}

function SendDataMySql({numShet, fullDate, tokA, tokB, tokC, naprA, naprB, naprC, cosA, cosB, cosC})
{
    let date = `${fullDate.getFullYear()}-${fullDate.getMonth() + 1}-${fullDate.getDate()}`;
    let time = `${fullDate.getHours() - 3}:${fullDate.getMinutes()}:${fullDate.getSeconds()}`;

    //console.log(numShet);

    mysqlConnection.query(`INSERT pokaz_mgnznach(num_schet, date, time, tok_A, tok_B, tok_C, napr_A, napr_B, napr_C, cos_A, cos_B, cos_C) 
        VALUES (${numShet}, '${date}', '${time}', ${tokA}, ${tokB}, ${tokC}, ${naprA}, ${naprB}, ${naprC}, ${cosA}, ${cosB}, ${cosC})`, function (err)
        {
            if (err) throw err;
        });
}

//Занесение показаний счётчиков на начало суток в MySql
function setStartDate()
{
    console.log(`Занесение показаний счётчиков на начало суток`);

    let currentDate = new Date(Date.now());
    let tomorrowDate = new Date(Date.now());
    currentDate.setHours(currentDate.getHours() + 3);
    tomorrowDate.setHours(tomorrowDate.getHours() + 3);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);

    //console.log(currentDate.getDate());
    //console.log(tomorrowDate);
    mssqlConnection.request().query(`use [${mssqlConfig.database}]
        declare @dt date, @dt1 date
        set @dt= DATEFROMPARTS(${currentDate.getFullYear()}, ${currentDate.getMonth() + 1}, ${currentDate.getDate()})
        set @dt1 = DATEFROMPARTS(${tomorrowDate.getFullYear()}, ${tomorrowDate.getMonth() + 1}, ${tomorrowDate.getDate()})
        SELECT  [ResIsmEnergy].[IdShet]
            ,NameNode
            ,WorkNumber
            ,[ActPl]
            ,[ReactPl]
            , @dt
            ,DtPriem
            
        FROM [${mssqlConfig.database}].[dbo].[ResIsmEnergy] 
        
        left join [${mssqlConfig.database}].[dbo].[Shet] 
        on ResIsmEnergy.IdShet= Shet.IdShet
            left join BalansGroupShet
            on ResIsmEnergy.IdShet= BalansGroupShet.IdShet
            left join BalansGroup
            on BalansGroupShet.IdBalansGroup = BalansGroup.idBalansGroup
        Where Command = 53 and DtPriem>@dt and DtPriem<@dt1 order by NameNode`, (err, result) => 
        {
            if (err) throw err;

            //console.log(result.recordset);

            for (let row of result.recordset)
            {
                let {WorkNumber, DtPriem, ActPl} = row;

                let date = `${DtPriem.getFullYear()}-${DtPriem.getMonth() + 1}-${DtPriem.getDate()}`;
                let time = `${DtPriem.getHours() - 3}:${DtPriem.getMinutes()}:${DtPriem.getSeconds()}`;

                mysqlConnection.query(`INSERT pokaz_startdate(num_schet, pokaz_date, pokaz_time, pokaz_pol) 
                    VALUES (${WorkNumber}, '${date}', '${time}', ${ActPl})`, function (err)
                    {
                        if (err) throw err;
                    });
            }

        });
}

//Ручной ввод конфигурации MSSQL
function setMsSqlConfig()
{
    let mssqlConfig = {};
    console.log(`\n----------Настройка подключения к MsSql---------- \n`);
    mssqlConfig.server = userInput(`Имя сервера: `);
    mssqlConfig.user = userInput(`Имя входа: `);
    mssqlConfig.password = String(userInput(`Пароль: `));
    mssqlConfig.database = userInput(`Имя базы данных: `);
    mssqlConfig.pollingTimer = userInput(`Интервал обновления данных, мс (120000): `);
    mssqlConfig.beginningOfTheDay = userInput(`Время опроса счётчиков на начало суток (hh:mm): `);
    mssqlConfig.isMeterReading = userInput(`Снять показаний со счётчиков на начало суток сразу после запуска программу (для теста, 1 - да; 2 - нет): `);

    let mssqlConfigJSON = JSON.stringify(mssqlConfig);

    
    let con = new mssql.ConnectionPool(mssqlConfig);
    con.connect(function (err) 
    {
        if (!err) 
        {
            fs.writeFileSync(`config/config_mssql.json`, mssqlConfigJSON);
        };
        
    });
    return mssqlConfig;
}

//Ручной ввод конфигурации MYSQL
function setMySqlConfig()
{
    let mysqlConfig = {};
    console.log(`\n----------Настройка подключения к MySql---------- \n`);
    mysqlConfig.host = userInput(`Хост: `);
    mysqlConfig.port = userInput(`Порт: `);
    mysqlConfig.user = userInput(`Имя пользователя: `);
    mysqlConfig.password = String(userInput(`Пароль: `));

    if (mysqlConfig.password == " ") mysqlConfig.password = "";

    mysqlConfig.database = userInput(`Имя базы данных: `);

    let mysqlConfigJSON = JSON.stringify(mysqlConfig);

    let con = mysql.createConnection(mysqlConfig);
    con.connect(function (err) 
    {
        if (!err) 
        {
            fs.writeFileSync(`config/config_mysql.json`, mysqlConfigJSON); 
        };       
    });

    return mysqlConfig;
}
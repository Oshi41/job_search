const {useState, useEffect, useMemo, useRef, useCallback} = React;
const {
    colors,
    CssBaseline,
    ThemeProvider,
    Typography,
    Container,
    createTheme,
    Box,
    Card,
    SvgIcon,
    Link,
    Paper,
    Popover,
    Switch,
    CircularProgress,
    Skeleton,
    Snackbar,
    Alert,
    IconButton,
    Icon,
    Stack,
    TextField,
    Tooltip,
    Button,
    Modal,
} = MaterialUI;

const theme = createTheme({
    palette: {
        primary: {
            main: '#556cd6',
        },
        secondary: {
            main: '#19857b',
        },
        error: {
            main: colors.red.A400,
        },
    },
});

function install() {
    let root = document.getElementById('main_content');
    let react_root = ReactDOM.createRoot(root);
    react_root.render(<MainControl/>);
}

install();

function debounce(func, mls) {
    let timer, promise;
    return (...args) => {
        if (promise)
            return;
        clearTimeout(timer);
        timer = setTimeout(async () => {
            promise = new Promise(async (resolve, reject) => {
                try {
                    let res = await func.apply(this, args);
                    resolve(res);
                } catch (e) {
                    reject(e);
                } finally {
                    promise = null;
                }
            });
            await promise;
        }, mls);
    };
}

function MainControl() {
    const [loading, set_loading] = useState(false);
    const [data, set_data] = useState([]);
    const [sort, set_sort] = useState({});
    const [filter, set_filter] = useState({});
    const [page, set_page] = useState(0);
    const [per_page, set_per_page] = useState(10);
    const [total, set_total] = useState(0);
    const [editing, set_editing] = useState();
    const [info, set_info] = useState();


    const columns = useMemo(() => {
        return [
            {
                id: 'job_id',
                header: 'Job ID',
                cell: x => <a href={x.link}>{x.job_id}</a>,
            },
            {
                id: 'company_name',
                header: 'Company info',
                cell: x => <a href={x.company_link}>{x.company_name}</a>,
            },
            {
                id: 'location',
                header: 'Location',
                cell: x => x.location,
            },
            {
                header: 'Compatibility',
                cell: x => Number.isInteger(x.percentage) ? x.percentage + '%' : '-',
                id: 'percentage',
            },
            {
                header: 'Easy apply',
                cell: x => x.easy_apply ? 'yes' : 'no',
                select: {['-']: '', yes: true, no: false,},
                id: 'easy_apply',
            },
            {
                header: 'Create date',
                cell: x => new Date(x.vacancy_time).toDateString(),
                id: 'vacancy_time',
                disable_filter: true,
            },
            {
                header: 'Applies',
                cell: x => x.applies,
                id: 'applies',
            },
            {
                id: 'applied_time',
                header: 'Applied',
                cell: x => {
                    if (!x.applied_time)
                        return '-';
                    if (!(x.applied_time instanceof Date))
                        x.applied_time = new Date(x.applied_time);
                    if (x.applied_time.valueOf() == 0)
                        return 'cancelled';
                    return x.applied_time.toLocaleDateString();
                },
                disable_filter: true,
            },
            {
                header: 'Actions',
                disable_sort: true,
                disable_filter: true,
                cell: x => {
                    return <Stack direction="row" useFlexGap>
                        <Tooltip title='Edit vacancy'>
                            <IconButton onClick={() => set_editing({...x})}>
                                <Icon>edit</Icon>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title='Show info'>
                            <IconButton onClick={e => set_info(x)}>
                                <Icon>info</Icon>
                            </IconButton>
                        </Tooltip>
                    </Stack>
                },
            }
        ];
    }, [set_info, set_editing]);
    const on_update = (opts) => {
        let {
            filter: _filter,
            sort: _sort,
            page: _page,
            per_page: _per_page,
        } = opts;
        if (_filter)
            set_filter(_filter);
        if (_sort)
            set_sort(_sort);
        if (Number.isInteger(_page))
            set_page(_page);
        if (Number.isInteger(_per_page))
            set_per_page(_per_page);
    };
    const request_update = debounce(async () => {
        try {
            set_loading(true);
            let resp = await fetch('/vacancies', {
                method: 'POST',
                body: JSON.stringify({
                    find: filter,
                    sort,
                    skip: page * per_page,
                    limit: per_page
                })
            });
            let {items, count} = await resp.json();
            set_data(items);
            set_total(count);
        } catch (e) {
            console.warn(e);
        } finally {
            set_loading(false);
        }
    }, 400);
    useEffect(() => {
        request_update();
    }, [sort, filter, page, per_page]);

    let Table = window.CustomTable;

    return <ThemeProvider theme={theme}>
        <div>
            <Modal open={!!info}
                   onClose={() => set_info(null)}>
                <Card sx={{
                    margin: '10%', maxHeight: '60%',
                    overflowY: 'auto', overflowX: 'hidden'
                }}>
                    <h1>Vacancy text</h1>
                    <Paper elevation={3} sx={{padding: '10px'}}>
                        {info && info.text && info.text.split('\n').map(x => <p>{x}</p>)}
                    </Paper>
                    <h1>Ai Response</h1>
                    <Paper elevation={3} sx={{padding: '10px'}}>
                        {info && info.ai_resp && info.ai_resp.split('\n').map(x => <p>{x}</p>)}
                    </Paper>
                </Card>
            </Modal>
            <h1>Vacancies</h1>
            <Table sort={sort} filter={filter} page={page} page_size={per_page} columns={columns} data={data}
                   on_update={on_update} total={total} loading={loading}/>
        </div>
    </ThemeProvider>;
}

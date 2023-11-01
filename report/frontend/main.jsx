const {useState, useEffect, useMemo, useRef} = React;
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
    Table,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    TableContainer,
    TableSortLabel,
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

function MainControl() {
    let [data, set_data] = useState([]);
    let [l, set_l] = useState(false);
    let [snackbars, set_snackbars] = useState([]);
    let snack_msg = useMemo(() => {
        if (snackbars.length > 0)
            return snackbars[0].text;
    }, [snackbars]);
    let snack_severity = useMemo(() => {
        if (snackbars.length > 0)
            return snackbars[0].severity;
    }, [snackbars]);

    /**
     * @param text {string}
     * @param severity {'error' || 'success' || 'warning' || 'info'}
     */
    function add_snackbar(text, severity = 'info') {
        set_snackbars([...snackbars, {text, severity}]);
    }

    function close_snackbar() {
        set_snackbars(snackbars.slice(1));
    }

    let [table_state, set_table_state] = useState({});
    let [order_by, set_order_by] = useState();
    let [order_direction, set_order_direction] = useState();
    let [search, set_search] = useState('');

    let tbody_ref = useRef(null);

    function use_table_state(name, def_val) {
        let value = table_state[name];
        let save_value = (new_val) => {
            table_state[name] = new_val;
            set_table_state({...table_state});
        };
        if (table_state.hasOwnProperty(name) && def_val !== undefined)
            save_value(def_val);
        return [value, save_value];
    }

    async function load_data() {
        set_l(true)
        try {
            // skeletons fake data
            set_data([{}, {}, {}]);
            let resp = await fetch('/vacancies');
            let vacancies = await resp.json();
            set_data(vacancies);
        } catch (e) {
            add_snackbar('Cannot load vacancies: ' + e.message, 'error');
            set_data([]); // clear table rows
        } finally {
            set_l(false);
        }
    }

    // auto load data
    useEffect(() => load_data(), []);

    const table_def = [
        {
            header: 'Job ID',
            value: x => x.job_id,
        },
        {
            header: 'Link',
            value: x => <a href={x.link}>{x.job_id}</a>,
            text: x => [x.job_id, x.link],
        },
        {
            header: 'Description',
            value: x => {
                return <Tooltip title={<Card sx={{maxWidth: '250px', maxHeight: '250px',
                        overflowY: 'scroll', overflowX: 'hidden'}}>
                    {x.text.split('\n').map(x=><p>{x}</p>)}
                </Card>}>
                    <IconButton>
                        <Icon>help</Icon>
                    </IconButton>
                </Tooltip>;
            },
            text: x => ['Show/hide vacancy text'],
        },
        {
            header: 'Location',
            value: x => <a>{x.location}</a>,
            text: x => [x.location],
        },
        {
            header: 'Compatibility',
            value: x => Number.isInteger(x.percentage) ? x.percentage + '%' : '-',
            sort: x => x.percentage || -1,
        },
        {
            header: 'Easy apply',
            value: x => x.easy_apply ? 'yes' : 'no',
            sort: x=>x.easy_apply,
        },
        {
            header: 'Create date',
            value: x => new Date(x.vacancy_time).toDateString(),
            sort: x => new Date(x.vacancy_time),
        },
        {
            header: 'Applies',
            value: x => x.applies,
        },
        {
            header: 'Applied',
            value: x => {
                if (x.applied_time)
                    return new Date(x.applied_time).toDateString();

                async function on_check() {
                    try {
                        set_l(true);
                        let res = await fetch('/set_applied', {
                            method: 'POST',
                            body: x.job_id,
                        });
                        if (!res.ok) {
                            throw new Error(res.statusCode + ' resp: ' + await res.text());
                        }
                    } catch (e) {
                        add_snackbar('Cannot apply for job: ' + e.message, 'error');
                    } finally {
                        load_data();
                    }
                }

                return !!l ? <CircularProgress/> :
                    <Switch label='Already applied' onChange={on_check}/>;
            },
            text: x => [x.applied_time ? new Date(x.applied_time).toDateString() : 'Already applied'],
            sort: x => new Date(x.applied_time||0),
        },
    ];

    let table_data = useMemo(() => {
        let result = [];
        const to_arr = obj => Array.isArray(obj) ? obj : [obj];

        // searching
        for (let src of data) {
            // if no search string - all filtered
            let filtered = !search || search.trim().length < 1;
            for (let {header, value, text} of table_def) {
                if (!filtered) {
                    let texts = (text ? to_arr(text(src)) : [value(src)]).map(x => '' + x).filter(Boolean);
                    if (texts.some(x => x.toLowerCase().includes(search)))
                        filtered = true;
                }
            }
            if (filtered)
                result.push(src);
        }

        // sorting
        if (result.length && order_by) {
            let {value, text, sort} = table_def.find(x => x.header === order_by);
            let compare_fn;
            if (sort)
                compare_fn = (a, b) => sort(a) - sort(b);
            else if (text) {
                compare_fn = (a, b) => {
                    let left = to_arr(text(a));
                    let right = to_arr(text(b));
                    for (let i = 0; i < left.length; i++) {
                        let diff = left[i] - right[i];
                        if (diff)
                            return diff;
                    }
                    return 0;
                };
            } else
                compare_fn = (a, b) => value(a) - value(b);

            result = result.sort(compare_fn);
            if (order_direction == 'desc')
            {
                result = result.reverse();
                console.log('reversed');
            }
        }

        return result;
    }, [data, order_by, order_direction, search]);

    return <ThemeProvider theme={theme}>
        <div>
            <Stack direction="row" useFlexGap >
                <h1 style={{width: '100%', verticalAlign: 'baseline'}}>Vacancies history</h1>
                <TextField sx={{verticalAlign: 'baseline'}}
                           label='Enter search text'
                           value={search}
                           onChange={e=>set_search(e.target.value)}
                />
            </Stack>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            {table_def.map(x => <TableCell key={x.header}>
                                <TableSortLabel active={order_by === x.header}
                                                direction={order_by === x.header ? order_direction : 'asc'}
                                                onClick={() => {
                                                    if (order_by !== x.header) {
                                                        set_order_direction('asc');
                                                        set_order_by(x.header);
                                                    } else {
                                                        set_order_direction(order_direction === 'asc' ? 'desc' : 'asc');
                                                    }
                                                }}>
                                </TableSortLabel>
                                {x.header}
                            </TableCell>)}
                        </TableRow>
                    </TableHead>
                    <TableBody ref={tbody_ref}>
                        {table_data && table_data.length && (
                            table_data.map(src => <TableRow key={src.header}>
                                {table_def.map(x => <TableCell key={src.header}>
                                    {l ? <Skeleton variant="text"/> : x.value(src)}
                                </TableCell>)}
                            </TableRow>)
                        ) || []}
                    </TableBody>
                </Table>
            </TableContainer>
            <Snackbar open={snackbars.length > 0}
                      autoHideDuration={6000}
                      onClose={close_snackbar}>
                <Alert onClose={close_snackbar} severity={snack_severity} sx={{width: '100%'}}>
                    {snack_msg}
                </Alert>
            </Snackbar>
        </div>
    </ThemeProvider>
}

window.addEventListener('load', () => {
    let root = document.getElementById('main_content');
    let react_root = ReactDOM.createRoot(root);
    react_root.render(<MainControl/>);
});
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
    let [info_obj, set_info_obj] = useState(null);
    let [edit_obj, set_edit_obj] = useState(null);

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

    let [order_by, set_order_by] = useState();
    let [order_direction, set_order_direction] = useState();
    let [search, set_search] = useState('');
    let [extended_search, set_extended_search] = useState(false);

    let tbody_ref = useRef(null);

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

    async function update() {
        let to_apply = {...edit_obj};
        let source = data.find(x => x.job_id == to_apply.job_id);
        if (!source)
            return add_snackbar('Cannot find ' + edit_obj.job_id, 'warning');

        set_l(true);
        try {
            await fetch('/vacancy', {
                method: 'PATCH',
                body: JSON.stringify(to_apply),
            });
        } catch (e) {
            add_snackbar('Cannot apply vacancy change: ' + e.message, 'error');
        } finally {
            set_edit_obj(null);
            load_data();
        }
    }

    // auto load data
    useEffect(() => load_data(), []);

    const table_def = [
        {
            header: 'Job ID',
            value: x => <a href={x.link}>{x.job_id}</a>,
            text: x => [x.job_id, x.link],
        },
        {
            header: 'Description',
            value: x => {
                return <Tooltip title={<Card sx={{
                    maxWidth: '250px', maxHeight: '250px',
                    overflowY: 'scroll', overflowX: 'hidden'
                }}>
                    {x.text.split('\n').map(x => <p>{x}</p>)}
                </Card>}>
                    <IconButton>
                        <Icon>help</Icon>
                    </IconButton>
                </Tooltip>;
            },
            text: x => extended_search ? [x.text, x.ai_resp] : [],
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
            sort: x => x.easy_apply,
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
                if (!x.hasOwnProperty('applied_time') || x.applied_time == null)
                    return '-';
                if (!(x.applied_time instanceof Date))
                    x.applied_time = new Date(x.applied_time);
                if (x.applied_time.valueOf() == 0)
                    return 'cancelled';
                return x.applied_time.toDateString();
            },
            sort: x => new Date(x.applied_time || -1),
        },
        {
            header: 'Actions',
            value: x => {
                return <Stack direction="row" useFlexGap>
                    <Tooltip title='Edit vacancy'>
                        <IconButton onClick={() => set_edit_obj({...x})}>
                            <Icon>edit</Icon>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title='Show info'>
                        <IconButton onClick={e => set_info_obj(x)}>
                            <Icon>info</Icon>
                        </IconButton>
                    </Tooltip>
                </Stack>
            },
            text: x => extended_search ? [x.text, x.ai_resp] : [],
        }
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
            if (order_direction == 'desc') {
                result = result.reverse();
                console.log('reversed');
            }
        }

        return result;
    }, [data, order_by, order_direction, search, extended_search]);

    return <ThemeProvider theme={theme}>
        <div>
            <Modal open={!!info_obj}
                   onClose={() => set_info_obj(null)}>
                <Card sx={{
                    margin: '10%', maxHeight: '60%',
                    overflowY: 'auto', overflowX: 'hidden'
                }}>
                    <h1>Vacancy text</h1>
                    <Paper elevation={3} sx={{padding: '10px'}}>
                        {info_obj && info_obj.text && info_obj.text.split('\n').map(x => <p>{x}</p>)}
                    </Paper>
                    <h1>Ai Response</h1>
                    <Paper elevation={3} sx={{padding: '10px'}}>
                        {info_obj && info_obj.ai_resp && info_obj.ai_resp.split('\n').map(x => <p>{x}</p>)}
                    </Paper>
                </Card>
            </Modal>
            <Modal open={!!edit_obj}
                   onClose={() => set_edit_obj(null)}>
                <Paper elevation={3}
                       sx={{
                           margin: '15% 25%', overflowY: 'auto', overflowX: 'hidden',
                           padding: '24px'
                       }}>
                    <Stack direction="column" spacing='4px'>
                        <h1>Edit vacancy № {edit_obj && edit_obj.job_id}</h1>
                        <Paper elevation={3} sx={{padding: '4px'}}>
                            <h4>AI response</h4>
                            <Stack direction="column" spacing='4px'>
                                <TextField label='Compatibility'
                                           inputProps={{inputMode: 'numeric', pattern: '[0-9]*'}}
                                           value={edit_obj && edit_obj.percentage}
                                           onChange={e => set_edit_obj({
                                               ...edit_obj,
                                               percentage: +e.target.value
                                           })}/>
                                {edit_obj && edit_obj.ai_resp && <Button startIcon={<Icon>clear</Icon>}
                                                                         onClick={() => {
                                    let obj = {...edit_obj};
                                    delete obj.percentage;
                                    delete obj.ai_resp;
                                    set_edit_obj(obj);
                                }}>Clear AI response</Button>}
                            </Stack>
                        </Paper>

                        <Paper elevation={3} sx={{padding: '4px'}}>
                            <h4>Apply status: {edit_obj && table_def.find(x => x.header == 'Applied').value(edit_obj)}</h4>
                            <Stack direction="column" spacing='4px'>
                                {edit_obj && !edit_obj.applied_time && ([
                                        <Button onClick={() => set_edit_obj({
                                            ...edit_obj,
                                            applied_time: new Date()
                                        })} startIcon={<Icon>approval</Icon>}>
                                            Already applied
                                        </Button>,

                                        <Button onClick={() => set_edit_obj({
                                            ...edit_obj,
                                            applied_time: new Date(0)
                                        })} startIcon={<Icon>do_not_disturb_off</Icon>}>
                                            Mark as cancelled
                                        </Button>
                                    ]
                                )}
                            </Stack>
                        </Paper>

                        <Button onClick={update} variant='contained'>Save</Button>
                    </Stack>
                </Paper>
            </Modal>
            <Stack direction="row" useFlexGap>
                <h1 style={{width: '100%', verticalAlign: 'baseline'}}>Vacancies history</h1>
                <Typography>Extended search</Typography>
                <Switch checked={extended_search}
                        onChange={e => set_extended_search(e.target.checked)}/>
                <TextField sx={{verticalAlign: 'baseline'}}
                           label='Enter search text'
                           value={search}
                           onChange={e => set_search(e.target.value)}
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
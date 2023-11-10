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
    Checkbox,
    FormControlLabel,
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

const useDebounceEffect = (fn, mls, deps) => {
    let timer_ref = useRef(null);
    let is_exec_ref = useRef(false);
    useEffect(() => {
        if (is_exec_ref.current)
            return;
        if (timer_ref.current)
            clearTimeout(timer_ref.current);
        timer_ref.current = setTimeout(async function execute() {
            try {
                is_exec_ref.current = true;
                await fn();
            } finally {
                is_exec_ref.current = false;
            }
        }, mls);
    }, deps);
}

function AddVacancyModal({close}) {
    const [text, set_text] = useState('');
    const [applied, set_applied] = useState(false);

    function get_help_text(text) {
        if (!text.trim())
            return '';
        if (Number.isInteger(+text))
            return '';
        try {
            let url = new URL(text);
            if (!url.hostname.endsWith('linkedin.com'))
                return 'You should use linkedin.com';

            let regex = /\/jobs\/view\/\d+/g;
            if (!regex.test(url.pathname))
                return 'You should use linkedin.com/jobs/view/JOB_ID';
            return '';
        } catch (e) {
            return 'Wrong URL';
        }
    }

    const helper_text = useMemo(() => get_help_text(text),
        [text]);
    const job_id = useMemo(() => {
        if (helper_text)
            return '';
        if (Number.isInteger(+text))
            return +text;
        let num = new URL(text).pathname.split('/').map(x => x.trim()).filter(Boolean)[2]
        return +num;
    }, [text, helper_text]);
    const link = useMemo(() => {
        if (Number.isInteger(job_id))
            return 'https://www.linkedin.com/jobs/view/' + job_id;
    }, [job_id]);

    return <Card sx={{margin: '20%', padding: '24px'}}>
        <Stack direction='column' sx={{alignItems: 'flex-start'}}>
            <h2>Add vacancy</h2>
            <TextField label='LinkedIn URL/ Job ID'
                       error={helper_text.trim().length > 0}
                       helperText={helper_text}
                       value={text}
                       onChange={e => set_text(e.target.value)}
                       fullWidth/>
            <FormControlLabel control={<Checkbox onChange={e => set_applied(e.target.value)}
                                                 value={applied}/>}
                              label='Already applied'
                              labelPlacement='end'
            />
            <Button disabled={!job_id || !link}
                    variant="contained"
                    onClick={() => close({
                        job_id,
                        link,
                        applied_time: applied ? new Date() : null,
                    })}>
                Create
            </Button>
        </Stack>
    </Card>
}

window.VacancyView = function MainControl({add_snackbar}) {
    const Table = window.CustomTable;
    const [loading, set_loading] = useState(false);
    const [data, set_data] = useState([]);
    const [sort, set_sort] = useState({});
    const [filter, set_filter] = useState({});
    const [page, set_page] = useState(0);
    const [per_page, set_per_page] = useState(10);
    const [total, set_total] = useState(0);
    const [selected, set_selected] = useState(null);
    const [show_info, set_show_info] = useState(false);
    const [show_add, set_show_add] = useState(false);

    /**
     * @param x {Vacancy}
     * @returns {string}
     */
    const applied_text = x => {
        if (!x.applied_time)
            return '-';
        if (!(x.applied_time instanceof Date))
            x.applied_time = new Date(x.applied_time);
        if (x.applied_time.valueOf() == 0)
            return 'cancelled';
        return x.applied_time.toLocaleDateString();
    };

    const request_data = useCallback(async () => {
        try {
            set_loading(true);
            let url = new URL('http://google.com');

            url.searchParams.append('limit', per_page);
            url.searchParams.append('skip', page * per_page);
            url.searchParams.append('sort', JSON.stringify(sort));
            url.searchParams.append('find', JSON.stringify(filter));

            let resp = await fetch('/vacancies' + url.search);
            let {items, count} = await resp.json();
            set_data(items);
            set_total(count);
        } catch (e) {
            add_snackbar('Error during items request: ' + e.message, 'error');
            console.error('Error during items request:', e);
        } finally {
            set_loading(false);
        }
    }, [filter, sort, page, per_page]);
    const on_update = useCallback((opts) => {
        let {
            filter: _filter,
            sort: _sort,
            page: _page,
            per_page: _per_page,
            selected: _selected,
        } = opts;
        if (_filter)
            set_filter(_filter);
        if (_sort)
            set_sort(_sort);
        if (Number.isInteger(_page))
            set_page(_page);
        if (Number.isInteger(_per_page))
            set_per_page(_per_page);
        if (_selected)
            set_selected(_selected);
    }, []);
    useDebounceEffect(request_data, 400, [request_data]);
    const table_data = useMemo(() => {
        if (loading)
            return [].fill({}, 0, per_page);
        return data;
    }, [data, loading, per_page]);
    const cancel_vacancy = useCallback(async (source) => {
        if (!source)
            return void add_snackbar('No selected row', 'warning');
        try {
            let res = await fetch('/vacancy', {
                method: 'PATCH',
                body: JSON.stringify({
                    job_id: source.job_id,
                    applied_time: new Date(0),
                }),
            });
            if (!res.ok)
                throw new Error('Cannot cancel vacancy:' + await res.text());
            add_snackbar(`Cancelled ${source.job_id} vacancy`, 'success');
        } catch (e) {
            add_snackbar('Error during cancelling vacancy: ' + e.message, 'error');
            console.error('Error during cancelling vacancy:', e);
        } finally {
            request_data();
        }
    }, [request_data]);
    const apply_on_vacancy = useCallback(async (source) => {
        if (!source)
            return void add_snackbar('No selected row', 'warning');
        try {
            let res = await fetch('/vacancy', {
                method: 'PATCH',
                body: JSON.stringify({
                    job_id: source.job_id,
                    applied_time: new Date(),
                }),
            });
            if (!res.ok)
                throw new Error('Cannot change vacancy:' + await res.text());
            add_snackbar(`Applied to ${source.job_id}`, 'success');
        } catch (e) {
            add_snackbar('Error during applying to vacancy: ' + e.message, 'error');
            console.error('Error during applying to vacancy:', e);
        } finally {
            request_data();
        }
    }, [request_data]);
    const reset_ai = useCallback(async (source) => {
        if (!source)
            return void add_snackbar('No selected row', 'warning');
        try {
            let res = await fetch('/vacancy', {
                method: 'PATCH',
                body: JSON.stringify({
                    job_id: source.job_id,
                    $unset: {
                        percentage: 1,
                        ai_resp: 1
                    },
                }),
            });
            if (!res.ok)
                throw new Error('Cannot change vacancy:' + await res.text());
            add_snackbar(`Applied to ${source.job_id}`, 'success');
        } catch (e) {
            add_snackbar('Error during applying to vacancy: ' + e.message, 'error');
            console.error('Error during applying to vacancy:', e);
        } finally {
            request_data();
        }
    }, [request_data]);
    const add_vacancy = useCallback(async (vacancy) => {
        set_show_add(false);
        try {
            set_loading(true);
            let res = await fetch('/vacancy', {
                method: 'POST',
                body: JSON.stringify(vacancy)
            });
            if (!res.ok)
                throw new Error('Error during vacancy creation: ' + await res.text());
            add_snackbar(`Vacancy ${vacancy.job_id} was added`, 'success');
        } catch (e) {
            add_snackbar('Cannot create vacancy: ' + e.message);
            console.warn('Cannot create vacancy: ', e);
        } finally {
            request_data();
        }
    }, [request_data, add_snackbar]);

    const columns = useMemo(() => {
        return [
            {
                id: 'job_id',
                header: 'Job ID',
                cell: x => <a href={x.link}>{x.job_id}</a>,
            },
            {
                id: 'company_name',
                header: 'Brief info',
                cell: x => {
                    return <Stack direction='row' sx={{alignItems: 'center'}}>
                        <Tooltip title='Show info'>
                            <IconButton onClick={e => {
                                set_show_info(true);
                                set_selected(x);
                            }}>
                                <Icon>info</Icon>
                            </IconButton>
                        </Tooltip>
                        <a href={x.company_link}>{x.company_name}</a>
                    </Stack>;
                },
            },
            {
                id: 'applied_time',
                header: 'Applied',
                cell: x => {
                    let text = applied_text(x);
                    const controls = [];
                    if (text == '-') {
                        controls.push(
                            <Tooltip title='Cancel vacancy (in case of outdated/already closed vacancies)'>
                                <IconButton onClick={() => cancel_vacancy(x)}>
                                    <Icon>cancel</Icon>
                                </IconButton>
                            </Tooltip>,

                            <Tooltip title='Mark as applied'>
                                <IconButton onClick={() => apply_on_vacancy(x)}>
                                    <Icon>check_circle</Icon>
                                </IconButton>
                            </Tooltip>
                        );
                    } else {
                        controls.push(text);
                    }
                    return <Stack direction='row' sx={{alignItems: 'center'}}>{controls}</Stack>;
                },
                select: {
                    any: {no_search: true},
                    applied: 'any',
                    'no applied': {search: null},
                    cancelled: {search: 0},
                },
            },
            {
                id: 'location',
                header: 'Location',
                cell: x => x.location,
            },
            {
                header: 'Compatibility',
                cell: x => {
                    let txt = Number.isInteger(x.percentage) ? x.percentage + '%' : '-';
                    let controls = [<Typography>{txt}</Typography>];
                    if (Number.isInteger(x.percentage)) {
                        controls.unshift(
                            <Tooltip title='Reset AI response'>
                                <IconButton onClick={() => reset_ai(x)}>
                                    <Icon>person_off</Icon>
                                </IconButton>
                            </Tooltip>
                        );
                    }
                    return <Stack direction='row' sx={{alignItems: 'center'}}>{controls}</Stack>;
                },
                id: 'percentage',
            },
            {
                header: 'Easy apply',
                cell: x => x.easy_apply ? 'yes' : 'no',
                select: {
                    '-': {no_search: true},
                    yes: {search: true},
                    no: {search: false},
                },
                id: 'easy_apply',
            },
            {
                header: 'Last database change',
                cell: x => {
                    if (!x.last_touch)
                        return '-';
                    return new Date(x.last_touch).toDateString()
                },
                id: 'last_touch',
                disable_filter: true,
            },
            {
                header: 'Applies',
                cell: x => x.applies,
                id: 'applies',
            },
        ];
    }, [cancel_vacancy]);

    return <ThemeProvider theme={theme}>
        <div>
            <Modal open={!!(show_info && selected)}
                   onClose={() => set_show_info(false)}>
                <Card sx={{
                    margin: '10%', maxHeight: '60%',
                    overflowY: 'auto', overflowX: 'hidden'
                }}>
                    <h1>[{selected && selected.job_id}] Vacancy text</h1>
                    <Paper elevation={3} sx={{padding: '10px'}}>
                        {selected && selected.text && selected.text.split('\n').map((x, i) => <p key={i}>{x}</p>)}
                    </Paper>
                    <h1>Ai Response</h1>
                    <Paper elevation={3} sx={{padding: '10px'}}>
                        {selected && selected.ai_resp && selected.ai_resp.split('\n').map(x => <p>{x}</p>)}
                    </Paper>
                </Card>
            </Modal>
            <Modal open={show_add}
                   onClose={() => set_show_add(false)}>
                <AddVacancyModal close={add_vacancy}/>
            </Modal>
            <Stack direction='row' gap='8px'>
                <h1 style={{width: '100%'}}>Vacancies</h1>
                <Tooltip title='Add vacancy via LinkedIn link/job ID'>
                    <Button variant="contained"
                            sx={{height: '48px'}}
                            disabled={loading}
                            onClick={() => set_show_add(true)}
                            startIcon={<Icon>add</Icon>}>
                        Add vacancy
                    </Button>
                </Tooltip>
                <Tooltip title='Update table data with same filters/sorting'>
                    <Button variant="contained"
                            onClick={request_data}
                            sx={{height: '48px'}}
                            disabled={loading}
                            startIcon={<Icon>refresh</Icon>}>
                        Refresh
                    </Button>
                </Tooltip>
            </Stack>
            <Table sort={sort} filter={filter} page={page} page_size={per_page} columns={columns} data={table_data}
                   on_update={on_update} total={total} loading={loading} selected={selected}/>
        </div>
    </ThemeProvider>;
}

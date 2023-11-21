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
    Select,
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



function AddVacancyModal({close, text, set_text}) {
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

window.VacancyView = function MainControl({add_snackbar, visible}) {
    const {CustomTable: Table, use_custom_table} = window;
    const [loading, set_loading] = useState(false);
    const [data, set_data] = useState([]);
    const [total, set_total] = useState(0);
    const [selected, set_selected] = useState(null);
    const [show_info, set_show_info] = useState(false);
    const [show_add, set_show_add] = useState(false);
    const [data_status, set_data_status] = useState({});
    const [add_text, set_add_text] = useState('');

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

    const request_data = useCallback(async ({filter, sort, page, page_size}) => {
        try {
            set_loading(true);
            let url = new URL('http://google.com');

            url.searchParams.append('limit', page_size);
            url.searchParams.append('skip', page * page_size);
            url.searchParams.append('sort', JSON.stringify(sort));
            url.searchParams.append('find', JSON.stringify(filter));

            let resp = await fetch('/vacancies' + url.search);
            let {items, count, status: _status} = await resp.json();
            for (let key in _status) {
                let frontend_status, val = _status[key];
                switch (val) {
                    case 'ai':
                        frontend_status = {icon: 'psychology_alt', tooltip: 'AI analyzing...'};
                        break;
                    case 'scrape':
                        frontend_status = {icon: 'travel_explore', tooltip: 'Scraping...'};
                        break;
                }
                if (frontend_status)
                    _status[key] = frontend_status;
                else
                    delete _status[key];
            }

            set_data(items);
            set_total(count);
            set_data_status(_status);
        } catch (e) {
            add_snackbar('Error during items request: ' + e.message, 'error');
            console.error('Error during items request:', e);
        } finally {
            set_loading(false);
        }
    }, [set_data, set_total, set_data_status, add_snackbar, set_loading]);
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
            let res = await fetch('/analyze', {
                method: 'POST',
                body: source.job_id,
            });
            if (!res.ok)
                throw new Error('Cannot request for ai regenerate:' + await res.text());
            add_snackbar(`Regenerating ai resp for ${source.job_id}`, 'success');
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
                id: 'percentage',
                cell: x => {
                    let txt = Number.isInteger(x.percentage) ? x.percentage + '%' : '-';
                    return <Stack direction='row' sx={{alignItems: 'center'}}>
                        {Number.isInteger(x.percentage) && <Typography sx={{marginRight: '8px'}}>{txt}</Typography>}
                        {!data_status[x.job_id] &&
                            <Tooltip
                                title={Number.isInteger(x.percentage) ? 'Regenerate AI response' : 'Generate AI resp'}>
                                <Stack direction='row'>
                                    <IconButton onClick={() => reset_ai(x)}>
                                        <Icon>psychology</Icon>
                                    </IconButton>
                                </Stack>
                            </Tooltip>
                        }
                        {data_status[x.job_id] && <CircularProgress/>}
                    </Stack>;
                },
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
                    let {icon, tooltip} = data_status[x.job_id] || {};
                    if (icon) {
                        return <div style={{position: 'relative', alignItems: 'center', display: 'flex', gap: '4px'}}>
                            <Tooltip title={tooltip}><Icon>{icon}</Icon></Tooltip>
                            <CircularProgress/>
                        </div>;
                    }
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
    }, [cancel_vacancy, data_status]);
    const table_props = use_custom_table({
        columns,
        data,
        total,
        request_data,
        visible,
    })


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
                        {selected && selected.html_content && <div
                            dangerouslySetInnerHTML={{__html: selected.html_content}}
                        />}
                    </Paper>
                    <h1>Ai Response</h1>
                    <Paper elevation={3} sx={{padding: '10px'}}>
                        {selected && selected.ai_resp && <div
                            dangerouslySetInnerHTML={{__html: selected.ai_resp}}
                        />}
                    </Paper>
                </Card>
            </Modal>
            <Modal open={show_add}
                   onClose={() => set_show_add(false)}>
                <AddVacancyModal close={add_vacancy} text={add_text} set_text={set_add_text}/>
            </Modal>
            <Stack direction='row' gap='8px'>
                <h1 style={{width: '100%'}}>Vacancies</h1>
                <Tooltip title='Add vacancy via LinkedIn link/job ID'>
                    <Button variant="contained"
                            sx={{height: '48px'}}
                            disabled={loading}
                            onClick={async () => {
                                set_show_add(true);
                                let text = filter.job_id;
                                if (!text) {
                                    let saved = await navigator.clipboard.readText();
                                    if (Number.isInteger(+saved))
                                        text = saved;
                                    else {
                                        try {
                                            new URL(saved);
                                            if (saved.includes('linkedin'))
                                                text = saved;
                                        } catch (e) {
                                             // ignored
                                        }
                                    }
                                }
                                set_add_text(text || '');
                            }}
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
            <Table {...table_props}/>
        </div>
    </ThemeProvider>;
}

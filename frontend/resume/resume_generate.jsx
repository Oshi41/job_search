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
    Tab,
    Tabs,
    TextareaAutosize,
    FormControlLabel,
    MenuItem,
    InputLabel,
    FormControl,
} = MaterialUI;

function get_by_path(value, path) {
    let paths = path.split('.');
    let res = value;
    while (paths.length && res)
        res = res[paths.shift()];
    return res;
}

window.ResumeGenerateView = function ({add_snackbar, set_loading, visible}) {
    const {use_async_callback} = window;

    const [data, set_data] = useState({});
    const [selected, set_selected] = window.use_query_param('compat', 'common')
    const [open, set_open] = useState(false);
    const [to_generate, set_to_generate] = useState('');
    const [to_generate_force, set_to_generate_force] = useState(false);
    const [to_generate_err, set_to_generate_err] = useState('');
    const options = useMemo(() => {
        let list = Object.keys(data).map(x => Number.isInteger(+x) ? +x : 'common');
        return list.map(x => <MenuItem key={x} value={x}>{x}</MenuItem>);
    }, [data]);

    const load_existing_resumes = use_async_callback(async (query) => {
            if (!visible)
                return;
            let resp = await fetch('/resumes' + query.toString());
            let _data = await resp.json();
            set_data(prev => {
                let res = {...prev};
                for (let key of Object.keys(_data)) {
                    let src = data[key] || {};
                    let new_val = _data[key] || {};
                    res[key] = Object.assign(src, new_val);
                }
                return res;
            });
        },
        {add_snackbar, set_loading, err_hdr: 'Error during requesting resumes:'},
        [visible]);
    const generate_request = use_async_callback(async () => {
            if (!visible)
                return;
            await fetch('/generate_resume?force=' + to_generate_force, {
                method: 'POST',
                body: to_generate
            });
            add_snackbar('Successfully generated resume', 'success');

            let url = new URL('http://google.com');
            url.searchParams.set('percentage', to_generate);
            url.searchParams.set('folder', 'true');
            load_existing_resumes(url.search);
            set_open(false);
        },
        {add_snackbar, set_loading, err_hdr: 'Error during generating resume:'},
        [to_generate, to_generate_force, visible]);
    useEffect(() => {
        if (!visible)
            return;

        let url = new URL('http://google.com');
        url.searchParams.set('all', 'true');
        url.searchParams.set('folder', 'true');
        load_existing_resumes(url.search);
    }, [visible]);


    return <Stack gap='8px' direction='column'>
        <Modal open={open} onClose={() => set_open(false)}>
            <Card sx={{
                width: '40%',
                margin: 'auto',
                display: 'block',
                marginTop: '10%',
                padding: '24px',
            }}>
                <Stack gap='8px' direction='column'>
                    <h1>Generate resume</h1>
                    <InputLabel>You need to select AI compatibility percentage. Use 'common' to generate resume without
                        AI compatibility message</InputLabel>
                    <TextField label='Percentage'
                               error={!!to_generate_err}
                               helperText={to_generate_err}
                               value={to_generate}
                               onChange={e => {
                                   set_to_generate(e.target.value);
                                   set_to_generate_err('');
                               }}
                    />
                    <FormControlLabel control={<Checkbox onChange={e => set_to_generate_force(e.target.checked)}
                                                         value={to_generate_force}/>}
                                      label='Force regeneration'
                                      labelPlacement='end'
                    />
                    <Button sx={{width: '100px'}}
                            disabled={!to_generate || !!to_generate_err}
                            onClick={() => {
                                let number = +to_generate;
                                if (Number.isInteger(number)) {
                                    if (number < 0)
                                        return set_to_generate_err('Value cannot be smaller than 0');
                                    if (number > 100)
                                        return set_to_generate_err('Value cannot be bugger than 100');
                                } else if (to_generate == 'common') {
                                    // ignore
                                } else {
                                    return set_to_generate_err('Enter value in range 0..100 or "common"');
                                }
                                generate_request();
                                set_to_generate_err('');
                            }} variant='outlined'>Generate</Button>
                </Stack>
            </Card>
        </Modal>
        <h1>Select compatibility</h1>
        <Button sx={{width: '100px'}} onClick={() => set_open(true)} variant='outlined'>Generate</Button>
        <FormControl>
            <InputLabel>Percentage</InputLabel>
            <Select label='Percentage'
                    value={selected}
                    onChange={e => set_selected(e.target.value)}>
                {options}
            </Select>
        </FormControl>

        {selected && data && [
            <embed
                src={'/resume_preview?percentage=' + selected}
                type="application/pdf"
                frameBorder="0"
                scrolling='disable'
                height="5000px"
                width="100%">
            </embed>,
        ]}
    </Stack>;
}
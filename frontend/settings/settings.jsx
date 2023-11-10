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
    TextareaAutosize,
} = MaterialUI;

/**
 * @param login {string}
 * @param pass {string}
 * @param on_update {({login: string?, pass: string?})=>void}
 * @returns {JSX.Element}
 * @constructor
 */
window.SettingsView = function ({add_snackbar}) {
    const [cfg, set_cfg] = useState({});
    const [login, set_login] = useState('');
    const [pass, set_pass] = useState('');
    const [search_temp, set_search_temp] = useState('');
    const [location, set_location] = useState('')
    const [prompt, set_prompt] = useState('')
    const [searches, set_searches] = useState([]);
    const [enc_pass, set_enc_pass] = useState('');
    const [show_enc_pass, set_show_enc_pass] = useState(false);
    const [loading, set_loading] = useState(false);

    const on_add_search = useCallback(() => {
        set_searches(prevState => [...prevState, search_temp]);
        set_search_temp('');
    }, [search_temp]);

    const get_settings = useCallback(async () => {
        try {
            let q = enc_pass ? '?pass=' + enc_pass : '';
            let res = await fetch('/settings' + q,
                {method: 'GET',});
            let data = await res.json();
            set_cfg(data);
        } catch (e) {
            add_snackbar('Error during retrieving settings: ' + e.message, 'error');
        }
    }, [enc_pass]);

    useEffect(() => {
        get_settings();
    }, []);

    useEffect(() => {
        let config = cfg || {};
        set_login(config.login || '');
        set_pass(config.pass || '');
        set_location(config.location || '');
        set_searches(config.searches || []);
        set_prompt(config.prompt || '');
    }, [cfg]);

    const save_settings = useCallback(async () => {
        let cfg = {login, pass, location, searches, prompt};
        try {
            set_loading(true);
            await fetch('/settings', {
                method: 'POST',
                body: JSON.stringify(cfg),
            });
            add_snackbar('Saved settings', 'success');
        } catch (e) {
            add_snackbar('Error during save settings: ' + e.message, 'error');
        } finally {
            set_loading(false);
        }
    }, [login, pass, location, searches, prompt]);

    const skeleton = useMemo(() => <Skeleton height={48} width={400}/>, []);


    return <Paper elevation={3} sx={{padding: '10px'}}>
        <Stack direction='column' gap='12px'>
            <h1>Settings</h1>
            <h3>Linkedin settings</h3>
            {!loading && [
                <TextField label='Linkedn login'
                           value={login}
                           onChange={e => set_login(e.target.value)}
                />,
                <TextField label='Linkedn password'
                           value={pass}
                           type="password"
                           onChange={e => set_pass(e.target.value)}
                />
            ]}
            {loading && [
                skeleton,
                skeleton,
            ]}
            <h3>Searches</h3>
            {!loading && [
                <TextField label='Linkedn job location'
                           value={location}
                           sx={{alignSelf: 'flex-start', width: '650px'}}
                           onChange={e => set_location(e.target.value)}
                />,
                <TextField label='Insert search for LinkedIn'
                           value={search_temp}
                           onChange={e => set_search_temp(e.target.value)}
                           onKeyDown={e => {
                               if (e.key == 'Enter')
                                   on_add_search();
                           }}
                           sx={{alignSelf: 'flex-start', width: '650px'}}
                           InputProps={{
                               endAdornment: <IconButton onClick={on_add_search}><Icon>check</Icon></IconButton>,
                           }}
                />
            ]}
            {loading && [
                skeleton,
                skeleton,
            ]}
            <ul>
                {searches.map(x => <li>
                    <Stack direction='row' sx={{alignItems: 'center'}}>
                        {loading && skeleton}
                        {!loading && [
                            <IconButton onClick={() => set_searches(prev => prev.filter(p => p != x))}>
                                <Icon>close</Icon>
                            </IconButton>,
                            <Typography>{x}</Typography>,
                        ]}
                    </Stack>
                </li>)}
            </ul>
            <h3>Additional AI prompt</h3>
            {!loading && <TextareaAutosize minRows={3}
                                           placeholder="Enter additional prompt for helping AI range vacancies. Use main idea - to lower percentage if something doesn't suit you.
Example:
Prefer on site vacancies. Give preference to vacancies with specified salary."></TextareaAutosize>}
            {loading && skeleton}

            {!loading && <Button sx={{marginTop: '5%'}}
                                 variant='contained'
                                 onClick={() => save_settings()}>
                Save settings
            </Button>}
            {loading && <Skeleton variant='rounded'/>}
        </Stack>
    </Paper>
};
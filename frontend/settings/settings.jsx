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
    const [ai_cfg, set_ai_cfg] = useState([]);
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
        let src = config.ai || [];

        function get_icon_path(type) {
            switch (type) {
                case 'bing':
                    return <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="32" height="32"
                                viewBox="0 0 50 50">
                        <path
                            d="M 10 4 C 13.148438 4.960938 16.300781 5.921875 19.445313 6.890625 C 19.441406 14.664063 19.453125 22.4375 19.441406 30.210938 C 16.382813 32.917969 13.339844 35.644531 10.289063 38.363281 C 17.746094 34.445313 25.199219 30.519531 32.65625 26.59375 C 30.585938 25.652344 28.515625 24.726563 26.445313 23.78125 C 25.054688 20.746094 23.652344 17.71875 22.257813 14.683594 C 29.171875 16.796875 36.085938 18.917969 43 21.039063 C 43 24.417969 43 27.796875 43 31.175781 C 35.132813 35.867188 27.257813 40.550781 19.390625 45.242188 C 16.261719 43.050781 13.132813 40.855469 10 38.664063 C 10 27.109375 10 15.554688 10 4 M 10 2 C 9.574219 2 9.15625 2.136719 8.808594 2.394531 C 8.300781 2.769531 8 3.367188 8 4 L 8 38.660156 C 8 39.316406 8.316406 39.925781 8.851563 40.300781 C 10.980469 41.789063 13.109375 43.28125 15.234375 44.773438 L 18.242188 46.882813 C 18.585938 47.121094 18.984375 47.242188 19.390625 47.242188 C 19.742188 47.242188 20.097656 47.148438 20.414063 46.960938 C 24.761719 44.367188 29.109375 41.777344 33.460938 39.1875 L 44.023438 32.894531 C 44.628906 32.535156 45 31.882813 45 31.175781 L 45 26.109375 L 44.996094 21.039063 C 44.996094 20.160156 44.425781 19.386719 43.585938 19.128906 L 39.003906 17.722656 C 33.617188 16.070313 28.226563 14.417969 22.839844 12.773438 C 22.644531 12.714844 22.449219 12.6875 22.253906 12.6875 C 21.972656 12.6875 21.699219 12.746094 21.445313 12.855469 C 21.445313 10.867188 21.445313 8.882813 21.445313 6.894531 C 21.445313 6.015625 20.875 5.242188 20.035156 4.980469 C 16.886719 4.011719 13.734375 3.046875 10.582031 2.089844 C 10.390625 2.027344 10.195313 2 10 2 Z M 21.441406 30.238281 C 21.441406 30.230469 21.441406 30.222656 21.441406 30.210938 C 21.445313 26.046875 21.445313 21.878906 21.445313 17.710938 C 21.695313 18.246094 21.941406 18.785156 22.191406 19.320313 C 23.003906 21.085938 23.816406 22.851563 24.628906 24.617188 C 24.828125 25.054688 25.179688 25.40625 25.617188 25.605469 C 26.445313 25.980469 27.273438 26.355469 28.101563 26.730469 L 26.457031 27.597656 C 24.785156 28.476563 23.113281 29.359375 21.441406 30.238281 Z"></path>
                    </svg>;

                case 'claude':
                    return <img width="32" height="32"
                                src='https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/claude-ai-icon.png'></img>;

                case 'gpt':
                    return <img width="32" height="32"
                                src='https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/chatgpt-icon.png'></img>;

                case 'you':
                    return <img width="32" height="32"
                                src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAE80lEQVR4AZWXA9AkSRQG+4zQ2b5b27Zt27Zt2/burG3btu2xvfMuvop4td0z3bN3FZEx+JFZ1VZKdS4v6drQkrZUCde4EkW9Z+pU9bxuWsNJemyc7aWjez2CK6cC4nVcIwfN7WGWrB7gEGwa9dotGPLizLbRz8Y12Xskldop30BcrryHqpWLJtCwTFDQrGZI0L9LgE6eiNH1c1G6cytGTx/GRMD0Rnaa284pWN3VLiO2D7drQAh7pbxssTdkRI2iIQ6RYOYIgNz8MgYRR8SHcIxuhFj2krlCVCBPTAO+YziCqZrLT9s3vZW7nCQ2y4iKNkRoQpa0tApWtbPE4kPgFrPXyo1DIGb2mHxSjoHPA4paRQSYWt4sIxbWNyeE8Coo2OFyZIxSprQxwms8hTKFgSai2l9erICQh4JvA3rlsydEgHnVzYgAmgjsmEqmjD4z5CoMIzik4K9+bH8px8Am6JjdhQDBuBLmhAgOMTWykIjo9Oy1kiJFQIrTptS+Ap0QBLCcB7Y7AngVOAIkjUCAEP7zN+FVjW5I5t/DNLR/hOJH7XQeDpARwwvqR3DA6gbPSR2gJiEIYgZ7v3rgkMR+0TwrRyQNANoAtfTvPxIjIMXrt1/GaMGsMMUPrAhWQB0AOEAdsbic9V0B+nz+QUx36XEmLPG93zAAsJwDwLpKdhkAgVEEZg257syxI3ZuGVUHcIQMGJ/XKQLmFHRIOZArgPM6znQQMRAyEGCWegMBk8dEKO9HAc0KgAHZPDIAcqCevVyBZasj4qQC8B4zxSsuNhD8l4G/wSoggOUAcnWAqZBLyndXtwoUlgG+svEZzmjWIH4sHx/GkZAQoJYDIS/tfBuAaznL+eJiJMfv4HKMZcfQi0AAy6dlcavlEEtOVnTIFcA/hthw5gjEEZCyQEiAHRfLrjdwtUOAWr4uh4P2FLABlkuUAnXdVLR1iFoPDtPkxWI/AOI9vstSLgApXtXgrGgYgSsdAuLlp4q+FkB8vewrulz1OSnl2tlEAMja1JcUxDK4ewJGEcfHeHXlEAMZUH6QnZj8vV3vBMGM+h5Rb1wfbjaUP6p8T6BUnOokNYXGWZPCsS3aPZH0rPwA9wOGETeK32akGDxseI2UKsssBIouNidQcN5TSdmp9yX1R94W9OtyXTKp6iW6seKmbgREz6ue1UWptOtpjCm08QnpUcp0XUOLuScEgyfsp+k9j0nW1N2fEOHafZdeVNsjsdXTokj5/gekJv/uKwlU2n4+CNQBYPnALYLdXdfT0RarZQTkz5vMJ0cTky62lsvDCv5h/pM3yIh8Jw5JKu/fLmi+y0QDVi0XzJo/nzZOmiE412uW5MboiULubj/lTTKUcmcuXyh4+QoxOa6eUPO/AiAFTwYOEPj69EuKs3efk0rhiwfH6YnT39wjyHlps6Tk+bkCBAzdOUIwb2NfWr+qG52Y11XwYEpbgWNMC0l4VDNd7MOaTFLwrBYvBSlurZf8fWsxxJJ2x/sDTcDOLbXpmqmawDqnqiQ8o7wh9gXZ0ohHM6yCnpjlIN2lMUJe+fxgAQL6HWlMM/fXglwT8Hp1AUF4SV5DnEvTjtE8nKa4tHRcvFQt51e9AI7YuzMfXduWjR5uySACguvS6cJyGcBgcyDkx0uzT35/aUqAgZgpc7IjgwAZATnDEdbNv/sZ18Zfz0OMZVc7/wWAXF3bKsBBsAAAAABJRU5ErkJggg=='></img>;
            }
        }

        src = src.map(x => ({
            name: x.name,
            use: x.use,
            icon: get_icon_path(x.name),
        }));
        set_ai_cfg(src);
    }, [cfg]);

    const save_settings = useCallback(async () => {
        let cfg = {
            login,
            pass,
            location,
            searches,
            prompt,
            ai: ai_cfg.map(x => ({name: x.name, use: x.use})),
        };
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
                                           value={prompt}
                                           onChange={(e) => set_prompt(e.target.value)}
                                           placeholder="Enter additional prompt for helping AI range vacancies. Use main idea - to lower percentage if something doesn't suit you.
Example:
Prefer on site vacancies. Give preference to vacancies with specified salary."></TextareaAutosize>}
            {loading && skeleton}

            <h3>AI settings</h3>
            <Typography>Program will use any possible Ai for response in this order. You can switch off any AI that is not working properly.</Typography>
            <Stack direction='column' sx={{padding: '10px'}}>
                {ai_cfg.map(x => {
                    const on_click = (e) => {
                        x.use = e.target.checked;
                        set_ai_cfg([...ai_cfg]);
                    };
                    return <FormControlLabel label={x.name} control={
                        <Stack direction='row' sx={{marginRight: '8px'}}>
                            <Switch checked={x.use} onChange={on_click}/>
                            {x.icon}
                        </Stack>
                    }/>;
                })}
            </Stack>

            {!loading && <Button sx={{marginTop: '5%'}}
                                 variant='contained'
                                 onClick={() => save_settings()}>
                Save settings
            </Button>}
            {loading && <Skeleton variant='rounded'/>}
        </Stack>
    </Paper>
};
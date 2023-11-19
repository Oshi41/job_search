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
} = MaterialUI;

const resume_obj_keys = 'name title email location phone ai_message links photo cv_text cv_footer'.split(' ');

/**
 *
 * @param file {File}
 * @returns {Promise<string>}
 */
async function file2base64(file) {
    let fr = new FileReader();
    fr.readAsDataURL(file);
    return await new Promise((resolve, reject) => {
        fr.onload = () => {
            resolve(fr.result);
        };
        fr.onerror = reject;
    });
}

export function get(value, path){
    let paths = path.split('.');
    let res = value;
    while (paths.length && res)
        res = res[paths.shift()];
    return res;
}

function resume_settings({add_snackbar, visible, set_loading}) {
    const [orig, set_orig] = useState({});

    const [data, set_data] = useState({});
    const [error, set_error] = useState({});
    const [add_link, set_add_link] = useState();

    // copy result from server
    useEffect(() => {
        set_data({...orig});
    }, [orig]);
    // checking error message
    useEffect(() => {
        let new_error = {};
        if (data.ai_message && !data.ai_message.includes('%s')) {
            new_error.ai_message = 'You should left "%s" as percentage placeholder';
        }
        set_error(error);
    }, [data]);

    const to_apply = useMemo(() => {
        let result = {};
        for (let key of resume_obj_keys) {
            let l = data[key];
            let r = orig[key];
            if (l == r)
                continue;
            if (Array.isArray(l) && Array.isArray(r) && l.length == r.length && (l.length == 0 || l.every(x => r.includes(x))))
                continue;
            result[key] = l;
        }
        return result;

    }, [data, orig]);
    const changed = useMemo(() => {
        return Object.keys(to_apply || {}).length;
    }, [to_apply]);
    const can_add_link = useMemo(() => {
        if (!add_link)
            return false;

        try {
            let url = new URL(add_link);
            return !!url.host;
        } catch (e) {
            return false;
        }
    }, [add_link]);
    const can_save = useMemo(() => {
        return true;
        if (Object.keys(error).length)
            return false;
        let keys = 'name title email location phone ai_message links photo cv_text cv_footer'.split(' ');
        for (let key of keys) {
            let val = data[key];
            if (!val)
                return false;
            if (Array.isArray(val) && !val.length)
                return false;
        }
        return changed;
    }, [data, error, changed]);
    const links_ctrl = useMemo(() => {
        if (data && data.links && data.links.length) {
            return data.links.map(x => {
                let label = x;
                try {
                    let url = new URL(x);
                    label = url.host + url.pathname;
                } catch (e) {
                    // ignored
                }
                return <li key={x} style={{marginTop: '8px'}}>
                    <Stack direction='row' gap='8px'>
                        <Tooltip title={x}>
                            <div style={{
                                width: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                alignItems: 'center',
                                whiteSpace: 'nowrap',
                            }}>
                                <a href={x}>{label}</a>
                            </div>
                        </Tooltip>
                        <Button variant='outlined' onClick={() => {
                            set_data(prev => {
                                let {links = []} = prev || {};
                                links = links.filter(link => link != x);
                                return {
                                    ...prev,
                                    links: Array.from(links),
                                };
                            });
                        }}>delete</Button>
                    </Stack>
                </li>
            });
        }
        return [];
    }, [data.links, set_data]);
    const load_from_srv = useCallback(() => {
        async function load() {
            try {
                set_loading(true);
                let resp = await fetch('/resume_settings');
                let _orig = await resp.json();
                set_orig(_orig);
            } catch (e) {
                add_snackbar('Error during retrieving settings: ' + e.message, 'error');
                console.error('Error during retrieving settings:', e);
            } finally {
                set_loading(false);
            }
        }

        load();
    }, [add_snackbar, set_loading]);
    const load_to_srv = useCallback(() => {
        async function load() {
            set_loading(true);
            try {
                await fetch('/resume_settings', {
                    method: 'POST',
                    body: JSON.stringify(to_apply),
                });
                add_snackbar('Settings saved', 'success');
            } catch (e) {
                console.error('Error during settings save:', e);
                add_snackbar('Error during settings save: ' + e.message);
            } finally {
                set_loading(false);
            }
        }

        load().finally(x => load_from_srv());
    }, [add_snackbar, set_loading, to_apply, load_from_srv]);
    const img_ctrl = useMemo(() => {
        if (!data.photo)
            return;

        return <img width='150px'
                    height='150px'
                    style={{objectFit: 'contain'}}
                    src={data.photo}
        />;
    }, [data.photo]);

    // load settings from srv
    useEffect(() => {
        if (visible)
            load_from_srv();
    }, [visible]);

    return <Stack gap='8px' direction='column'>
        <h1>Fill up the information for resume/letter generation</h1>
        <h3>Common info</h3>
        <TextField label='Enter your name'
                   value={data.name}
                   onChange={e => set_data(d => ({
                       ...d,
                       name: e.target.value,
                   }))}
                   fullWidth
                   error={!!error.name}
                   helperText={error.name}
        />
        <TextField label='Enter your job title'
                   value={data.title}
                   onChange={e => set_data(d => ({
                       ...d,
                       title: e.target.value,
                   }))}
                   fullWidth
                   error={!!error.title}
                   helperText={error.title}
        />
        <TextField label='Enter your email'
                   value={data.email}
                   inputProps={{type: 'email'}}
                   onChange={e => set_data(d => ({
                       ...d,
                       email: e.target.value,
                   }))}
                   fullWidth
                   error={!!error.email}
                   helperText={error.email}
        />
        <TextField label='Enter your location'
                   value={data.location}
                   onChange={e => set_data(d => ({
                       ...d,
                       location: e.target.value,
                   }))}
                   fullWidth
                   error={!!error.location}
                   helperText={error.location}
        />
        <TextField label='Enter your phone'
                   value={data.phone}
                   onChange={e => set_data(d => ({
                       ...d,
                       phone: e.target.value,
                   }))}
                   fullWidth
                   error={!!error.phone}
                   helperText={error.phone}
        />
        <h3>Socials</h3>
        <Stack direction='row'>
            <TextField label='Add link'
                       value={add_link}
                       onChange={e => set_add_link(e.target.value)}
                       sx={{width: '20%'}}
            />
            <Button variant='contained'
                    disabled={!can_add_link}
                    onClick={() => {
                        set_data(d => {
                            let {links = []} = d || {};
                            links.push(add_link);
                            return {
                                ...d,
                                links: Array.from(links),
                            };
                        });
                        set_add_link('');
                    }}>
                Add link
            </Button>
        </Stack>
        <ul>{links_ctrl}</ul>
        <h3>For resume</h3>
        <TextField label='Enter AI message for resume'
                   value={data.ai_message}
                   onChange={e => set_data(d => ({
                       ...d,
                       ai_message: e.target.value,
                   }))}
                   fullWidth
                   error={!!error.ai_message}
                   helperText={error.ai_message}
        />
        <h3>For cover letter</h3>
        {img_ctrl}
        <input type='file'
               accept='image/png'
               onChange={async e => {
                   let file = e.target.files[0];
                   let photo = await file2base64(file);
                   set_data(p => ({
                       ...p,
                       photo,
                   }));
               }}
        />
        <TextareaAutosize
            minRows={20}
            placeholder='Provide your cover letter text here'
            value={data.cv_text}
            onChange={e => set_data(d => ({
                ...d,
                cv_text: e.target.value,
            }))}
        />
        <TextareaAutosize
            minRows={3}
            placeholder='Provide your cover letter footer here'
            value={data.cv_footer}
            onChange={e => set_data(d => ({
                ...d,
                cv_footer: e.target.value,
            }))}
        />

        <Button disabled={!can_save}
                onClick={load_to_srv}
                variant='contained'>
            Save
        </Button>
    </Stack>;
}

function generate_resume({add_snackbar, set_loading, visible}) {
    const [data, set_data] = useState({})
    const [selected, set_selected] = useState('common');
    const [open, set_open] = useState(false);
    const [to_generate, set_to_generate] = useState('');
    const [to_generate_force, set_to_generate_force] = useState(false);
    const [to_generate_err, set_to_generate_err] = useState('');

    const options = useMemo(() => {
        let list = Object.keys(data).map(x => Number.isInteger(+x) ? +x : 'common');
        return list.map(x => <MenuItem key={x} value={x}>{x}</MenuItem>);
    }, [data]);
    const load_existing_resumes = useCallback((s_param) => {
        async function load() {
            set_loading(true);
            try {
                let resp = await fetch('/resumes' + s_param.toString());
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
            } catch (e) {
                console.error('Error during existing resumes loading:', e);
                add_snackbar('Error during existing resumes loading: ' + e.message, 'error');
            } finally {
                set_loading(false);
            }
        };
        load();
    }, [add_snackbar, set_loading]);
    const generate_request = useCallback(() => {
        async function load() {
            set_loading(true);
            try {
                await fetch('/generate_resume?force='+to_generate_force, {
                    method: 'POST',
                    body: to_generate
                });
                add_snackbar('Successfully generated resume');

                let url = new URL('http://google.com');
                url.searchParams.set('percentage', to_generate);
                url.searchParams.set('pdf', true);
                load_existing_resumes(url.search);
            } catch (e) {
                console.error('Error during resume generation:', e);
                add_snackbar('Error during resume generation: ' + e.message, 'error');
            } finally {
                set_loading(false);
            }
        }

        load();
    }, [to_generate, to_generate_force]);
    useEffect(() => {
        if (visible) {
            let url = new URL('http://google.com');
            url.searchParams.set('all', true);
            load_existing_resumes(url.search);
        }
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
        <Select label='Percentage'
                value={selected}
                onChange={e => set_selected(e.target.value)}>
            {options}
        </Select>

        {selected && data && [
            <a href={get(data, selected+'.pdf.folder')}>Open in folder</a>,
            <embed
                src={'/resume_preview?percentage='+selected}
                type="application/pdf"
                frameBorder="0"
                scrolling='disable'
                height="10000px"
                width="100%">
            </embed>,
        ]}

    </Stack>;
}

window.ResumeView = function (opts) {
    const [loading, set_loading] = useState(false);
    const [tab, set_tab] = useState(0);

    let tab_opt = {...opts, loading, set_loading};
    const tabs = [
        {
            title: 'Settings',
            content: resume_settings({...tab_opt, visible: tab === 0}),
        },
        {
            title: 'Generate',
            content: generate_resume({...tab_opt, visible: tab === 1}),
        },
    ];
    const tab_headers = useMemo(() => {
        return tabs.map((value, index) => <Tab label={value.title} value={index} key={index}/>);
    }, [tabs]);
    const tab_content = useMemo(() => get(tabs, tab+'.content'), [tabs, tab]);

    return <Stack gap='8px' direction='column'>
        <Modal open={loading}>
            <CircularProgress sx={{
                width: '48px',
                height: '48px',
                margin: 'auto',
                display: 'block',
                marginTop: '10%',
            }}/>
        </Modal>

        <Tabs value={tab}
              onChange={(e, i) => set_tab(i)}>
            {tab_headers}
        </Tabs>
        {tab_content}
    </Stack>;
}
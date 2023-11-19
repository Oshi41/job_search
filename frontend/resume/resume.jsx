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
} = MaterialUI;

function edit_resume({add_snackbar, set_loading, visible}) {
    const [data, set_data] = useState({});
    const [tex, set_tex] = useState(null);
    const [pdf, set_pdf] = useState(null);
    const [text, set_text] = useState(null);
    const [show_preview, set_show_preview] = useState(false);

    const load_common_resume = useCallback(async () => {
        try {
            set_loading(true);
            let res = await fetch('/resume');
            let _data = await res.json();
            set_data(_data);
        } catch (e) {
            add_snackbar('Error during common fetch resume: ' + e.message);
        } finally {
            set_loading(false);
        }
    }, [set_loading]);
    const on_switch = useCallback(async () => {
        let is_tex = !show_preview;
        set_show_preview(p => !p);
        if (data.tex != tex && is_tex) {
            set_loading(true);
            try {
                let res = await fetch('/preview', {
                    method: 'POST',
                    body: tex,
                });
                let _data = await res.json();
                set_data(_data);
            } catch (e) {
                add_snackbar('Error during preview: ' + e.message);
            } finally {
                set_loading(false);
            }
        }
    }, [data, tex, show_preview, set_loading]);

    useEffect(() => {
        if (visible)
            load_common_resume();
    }, [visible]);
    useEffect(() => {
        function set_val(fn, path) {
            let paths = path.split('.');
            let value = data;
            while (paths.length) {
                if (!value)
                    break;
                value = value[paths.shift()];
            }
            fn(value || null);
        }

        set_val(set_pdf, 'resume.pdf');
        set_val(set_tex, 'resume.tex');
        set_val(set_text, 'resume.text');
    }, [data]);

    return <Stack gap='8px' direction='column'>
        <Stack direction='row' gap='8px'>
            <h1 style={{width: '100%'}}>Using resume</h1>
            <FormControlLabel control={<Switch onChange={e => on_switch()}
                                               value={show_preview}/>}
                              label={!show_preview ? 'Show preview' : 'Show TeX'}
                              labelPlacement='end'
            />
        </Stack>

        {!show_preview && [
            <h3>TeX</h3>,
            <TextareaAutosize
                minRows={40}
                value={tex}
                onChange={(e) => set_tex(e.target.value)}
            />,
        ]}

        {show_preview && [
            <h3>PDF</h3>,
            <TextareaAutosize
                minRows={40}
                value={text}
                readOnly
            />,
        ]}
    </Stack>;
}

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

function create_resume({add_snackbar, visible, set_loading}) {
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

        load().finally(x=>load_from_srv());
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

window.ResumeView = function (opts) {
    const [loading, set_loading] = useState(false);
    const [tab, set_tab] = useState(0);

    let tab_opt = {...opts, loading, set_loading};
    const tabs = [
        {
            title: 'Create',
            content: create_resume({...tab_opt, visible: tab === 0}),
        },
        {
            title: 'Edit',
            content: edit_resume({...tab_opt, visible: tab === 1}),
        },
    ]
    const tab_headers = useMemo(() => {
        return tabs.map((value, index) => <Tab label={value.title} value={index} key={index}/>);
    }, [tabs]);
    const tab_content = useMemo(() => tabs[tab].content, [tabs, tab]);

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
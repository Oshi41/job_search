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
} = MaterialUI;

window.ScrapeView = function ({add_snackbar}) {
    const {CustomTable: Table, use_custom_table} = window;
    // const [table_data, set_table_data] = useState([]);
    // const [loading, set_loading] = useState(false);
    // const [srv_loading, set_srv_loading] = useState(false);
    //
    // const get_links = useCallback(async () => {
    //     try {
    //         set_loading(true);
    //         let res = await fetch('/links');
    //         let links = await res.json();
    //         if (links.loading) {
    //             set_srv_loading(true);
    //             setTimeout(get_links, 2000); // request again
    //         } else {
    //             let result = [];
    //             for (let [name, {url, scraping, total}] of Object.entries(links)) {
    //                 result.push({
    //                     name,
    //                     url,
    //                     scraping,
    //                     total
    //                 });
    //             }
    //             set_table_data(result);
    //             set_srv_loading(false);
    //         }
    //     } catch (e) {
    //         add_snackbar('Cannot get manual links: ' + e.message, 'error');
    //     } finally {
    //         set_loading(false);
    //     }
    // }, []);
    // const request_scraping = useCallback(async (arg) => {
    //     try {
    //         await fetch('/scrape', {
    //             method: 'POST',
    //             body: JSON.stringify(arg),
    //         });
    //     } catch (e) {
    //         add_snackbar('Error during scrape request: ' + e.message);
    //     } finally {
    //         get_links();
    //     }
    // }, [get_links]);
    // useEffect(() => void get_links(), []);
    //
    // const columns = useMemo(() => {
    //     return [
    //         {
    //             id: 'name',
    //             header: 'Search',
    //             disable_filter: true,
    //             disable_sort: true,
    //             cell: x => srv_loading || loading ? <Skeleton/> : <a href={x.url}>{x.name}</a>,
    //         },
    //         {
    //             id: 'total',
    //             header: 'Estimated count',
    //             disable_filter: true,
    //             disable_sort: true,
    //             cell: x => srv_loading || loading ? <Skeleton/> : x.total,
    //         },
    //         {
    //             id: 'total',
    //             header: 'Actions',
    //             disable_filter: true,
    //             disable_sort: true,
    //             cell: x => {
    //                 if (srv_loading || loading)
    //                     return <Skeleton/>;
    //
    //                 if (!x.scraping)
    //                 {
    //                     let fn = ()=>request_scraping(x);
    //                     return <Button onClick={fn}>Add to database</Button>;
    //                 }
    //
    //                 if (x.scraping)
    //                     return <CircularProgress/>;
    //             },
    //         },
    //     ]
    // }, [srv_loading, loading, request_scraping]);

    const [searches, set_searches] = useState([]);
    const [loading, set_loading] = useState(false);
    const get_searches = useCallback(async () => {
        try {
            set_loading(true);
            let res = await fetch('/settings');
            let data = await res.json();
            set_searches(data.searches);
        } catch (e) {
            add_snackbar('Error during retrieving settings: ' + e.message, 'error');
        } finally {
            set_loading(false);
        }
    }, [set_loading]);
    useEffect(() => {
        get_searches();
    }, [get_searches]);
    const columns = useMemo(() => {
        return [
            {
                id: 'search',
                header: 'Search keywords',
                cell: x => x.search,
            },
            {
                id: 'location',
                header: 'Job location',
                cell: x => x.location,
            },
            {
                id: 'count',
                header: 'Max jobs count',
                cell: x => x.count,
            },
        ];
    }, []);
    const table_props = use_custom_table({columns, data: searches});

    return <Stack direction='column'>
        <h3>Searches</h3>
        <Typography>Find suitable vacancies from searches below</Typography>
        <Table {...table_props}/>
    </Stack>
}
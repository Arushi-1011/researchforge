from app.modules.discovery.schemas import PaperResult, SearchRequest, SearchResponse

def test_search_request_defaults_and_limits() -> None:
    request = SearchRequest(query=" graph neural networks ")
    assert request.limit == 10
    assert request.sources == ["arxiv", "semantic_scholar"]

def test_paper_schema_keeps_source_metadata() -> None:
    paper = PaperResult(source="arxiv", source_id="1234.5", title="Sample", authors=["A"], year=2025)
    response = SearchResponse(query="sample", results=[paper])
    assert response.results[0].source_id == "1234.5"
    assert response.results[0].authors == ["A"]
